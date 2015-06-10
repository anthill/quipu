"use strict";

var SerialPort = require("serialport").SerialPort
var machina = require('machina');
var spawn = require('child_process').spawn;
var Promise = require('es6-promise').Promise;

var CONNECTION_TIMOUT = 20 * 1000;
var SSH_TIMEOUT = 3 * 1000;
var QUERY_TIMOUT = 10*1000;
var DEBUG = true;

var debug = function() {
    if (DEBUG)
        console.log.apply(console, arguments);
}

var dongle = new machina.Fsm({

    smsDevice: undefined,
    modemDevice: undefined,
    smsPort: undefined,
    modemPort: undefined,
    pppProcess: null,
    sshProcess: null,
    signalStrength: undefined,

    initialState: "uninitialized",

    cleanProcess: function(process){

        debug('Stopping process...');

        return new Promise(function(resolve, reject){
            debug('killing process id', process.pid);
            process.kill();
            process.on('exit', function(code){
                debug('Process killed');
                resolve(code);
            });
        });
    },

    openPorts: function(baudrate){

        var self = this;

        return new Promise(function(resolve, reject){

            // open sms Port
            self.smsPort = new SerialPort(self.smsDevice, {
                baudrate: baudrate ? baudrate : 9600
            });

            self.smsPort.on("open", function() {
                debug('SMS port opened');

                // open modem Port
                self.modemPort = new SerialPort(self.modemDevice, {
                    baudrate: baudrate ? baudrate : 9600 
                });

                self.modemPort.on("open", function(){
                    debug('Modem port opened');
                    resolve();
                });

                self.modemPort.on("error", function(){
                    reject();
                });

            });

            self.smsPort.on("error", function(){
                reject();
            });
        });    
    },

    "sendAT": function(port, command){
        if (port.isOpen())
            port.write(command + "\r");
        else
            console.log('Port ' + port + ' is not open');
    },

    watchSMS: function(){
        var self = this;

        this.smsPort.on('data', function(data) {

            var message = data.toString().trim();
            debug("Raw AT message from sms:\n", data.toString());
            // sms notifications
            if(message.slice(0,5) === "+CMTI"){
                self.smsPort.write('AT+CPMS="ME"\r');
                self.smsPort.write('AT+CMGR=0\r');
            }
            // sms content
            if(message.slice(0, 5) === "+CMGR"){
                var parts = message.split(/\r+\n/);
                var from = parts[0].split(",")[1].replace(new RegExp('"', "g"), "");
                var body = parts[1]
                self.emit("smsReceived", {body: body, from: from});
            }
            // signal strength
            if(message.slice(0, 5) === "^RSSI"){
                try {
                    var level = message.match(/:\s(\d+)/)[1];
                    self.signalStrength = parseInt(level);
                } catch(err){
                    console.log(err);
                }
            }
        });
    },


    states: {
        "uninitialized": {
            "*": function() {
                this.deferUntilTransition("initialized");
            },
            "initialize": function(devices, baudrate) {

                var self = this;
                this.smsDevice = devices.sms;
                this.modemDevice = devices.modem;

                self.openPorts()
                .then(function(){
                    self.transition("initialized");
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not open ports");
                });
            },
        },
        "initialized": {
            _onEnter : function () {
                this.watchSMS();

                this.smsPort.write("ATE1\r"); // echo mode makes easier to parse responses
                this.smsPort.write("AT+CMEE=2\r"); // more error
                this.smsPort.write("AT+CNMI=2,1,0,2,0\r"); // to get notification when messages are received
                this.smsPort.write("AT+CMGF=1\r"); // text mode for sms
                debug('INITIALIZED, listening to SMS');
            },
            "sendSMS": function(message, phone_no) {
                this.smsPort.write("AT+CMGF=1\r");
                this.smsPort.write('AT+CMGS="' + phone_no + '"\r');
                this.smsPort.write(message); 
                this.smsPort.write(Buffer([0x1A]));
                this.smsPort.write('^z');
            },
            "open3G": function() {

                var self = this;

                return new Promise(function(resolve, reject){

                    debug('modem device', self.modemDevice);

                    self.modemPort.on('data', function(data) {

                        var message = data.toString().trim();
                        debug("Raw AT message from modem:\n", data.toString());
                    
                        if(message.indexOf("CONNECT") > -1){
                            self.emit("connectReceived");
                        }
                    });

                    self.modemPort.write('ATH\r');
                    self.modemPort.write("ATE1\r");
                    self.modemPort.write('AT+CGDCONT=1,"IP","free"\r');
                    self.modemPort.write("ATD*99#\r");

                    self.on("connectReceived", function(){
                        console.log("Starting ppp");
                        var myProcess = spawn("pppd", [ "debug", "-detach", "defaultroute", self.modemDevice, "38400"]);
                        resolve(myProcess);
                    });
                        
                })
                .then(function(process){
                    self.pppProcess = process;
                    self.transition( "3G_connected" );
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not connect. Cleaning...");
                });
            },
        },

        "3G_connected": {
            _onEnter : function () {
                console.log('3G CONNECTED');
            },
            "sendSMS": function(message, phone_no) {
                this.smsPort.write("AT+CMGF=1\r");
                this.smsPort.write('AT+CMGS="' + phone_no + '"\r');
                this.smsPort.write(message); 
                this.smsPort.write(Buffer([0x1A]));
                this.smsPort.write('^z');
            },
            "close3G": function() {
                var self = this;

                self.modemPort.write("AT+CGACT=0,1\r");
                self.modemPort.write("AT+CGATT=0\r");

                self.cleanProcess(self.pppProcess)
                .then(function(code){
                    self.transition("initialized");
                });
            },

            "openTunnel": function(queenPort, antPort, target) {

                var self = this;

                new Promise(function(resolve, reject){
                    var myProcess = spawn("ssh", ["-N", "-R", queenPort + ":localhost:" + antPort, target]);
                    debug("nodeprocess :", myProcess.pid, "myProcess: ", process.pid);

                    myProcess.stderr.on("data", function(chunkBuffer){
                        var message = chunkBuffer.toString();
                        debug("=> " + message);
                        if (message.indexOf("Warning: remote port forwarding failed for listen port") !== -1){
                            reject({process: myProcess, msg:"Port already in use."});
                        }
                    });
                    // if no error after SSH_TIMEOUT then validate the connexion
                    setTimeout(function(){resolve(myProcess)}, SSH_TIMEOUT);

                })
                .then(function(process){
                    self.sshProcess = process;
                    self.transition( "tunnelling" );
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not make the tunnel. Cleanning...");
                    self.cleanProcess(err.process);
                });
            },

            "closeTunnel": function() {

                return this.cleanProcess(this.sshProcess)
                .then(function(){
                    console.log('SSH tunnel closed');
                });
            }

        },

        "tunnelling": {
            _onEnter: function(){
                debug('TUNNELLING');
            },

            "closeTunnel": function() {
                debug('Closing SSH tunnel');

                cleanProcess(this.sshProcess)
                .then(function(){
                    debug('SSH tunnel closed');
                    self.transition('3G_connected');
                });
            },

            "close3G": function(){
                this.handle("closeTunnel");
                this.deferUntilTransition("3G_connected");
                this.transition('3G_connected');
            }

        }
    }
});

module.exports = dongle;
