"use strict";

var SerialPort = require("serialport").SerialPort
var machina = require('machina');
var spawn = require('child_process').spawn;
var Promise = require('es6-promise').Promise;

var CONNECTION_TIMOUT = 20 * 1000;
var SSH_TIMEOUT = 3 * 1000;
var QUERY_TIMOUT = 10*1000;

var dongle = new machina.Fsm({

    smsDevice: undefined,
    modemDevice: undefined,
    smsPort: undefined,
    modemPort: undefined,
    pppProcess: null,
    sshProcess: null,

    initialState: "uninitialized",

    cleanProcess: function(process){

        console.log('Stopping process...');

        return new Promise(function(resolve, reject){
            console.log('killing process id', process.pid);
            process.kill();
            process.on('exit', function(code){
                console.log('Process killed');
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
                console.log('SMS port opened');

                // open modem Port
                self.modemPort = new SerialPort(self.modemDevice, {
                    baudrate: baudrate ? baudrate : 9600 
                });

                self.modemPort.on("open", function(){
                    console.log('Modem port opened');
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

    sendAT: function(port, command){
        if (port.isOpen())
            port.write(command + "\r");
        else
            console.log('Port ' + port + ' is not open');
    },

    watchSMS: function(){
        var self = this;

        this.smsPort.on('data', function(data) {

            var message = data.toString().trim();
            console.log(data.toString());
            if(message.slice(0,5) === "+CMTI"){
                self.smsPort.write('AT+CPMS="ME"\r');
                self.smsPort.write('AT+CMGR=0\r');
            }
            if(message.slice(0, 5) === "+CMGR"){
                var parts = message.split(/\r+\n/);
                var from = parts[0].split(",")[1].replace(new RegExp('"', "g"), "");
                var body = parts[1]
                self.emit("smsReceived", {body: body, from: from});
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
                
                console.log('INITIALIZED, listening to SMS');
			},
            "sendSMS": function(message, phone_no) {
                this.smsPort.write("AT+CMGF=1\r");
                this.smsPort.write('AT+CMGS="' + phone_no + '"\r');
                this.smsPort.write(message); 
                this.smsPort.write(Buffer([0x1A]));
                this.smsPort.write('^z');
            },
            "readUnreadSMS": function() {
            	this.smsPort.write("AT+CMGF=1\r");
            	this.smsPort.write('AT+CMGL="REC UNREAD"\r');
            },
            "readAllSMS": function() {            	
            	this.smsPort.write("AT+CMGF=1\r");
            	this.smsPort.write('AT+CMGL="ALL"\r');
            },
            "connect3G": function() {

                var self = this;

                new Promise(function(resolve, reject){

                    console.log('modem device', self.modemDevice);

                    self.modemPort.on('data', function(data) {

                        var message = data.toString().trim();
                        console.log(data.toString());
                    
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

            "disconnect3G": function() {
                var self = this;

                self.modemPort.write("AT+CGACT=0,1\r");
                self.modemPort.write("AT+CGATT=0\r");

                self.cleanProcess(self.pppProcess)
                .then(function(code){
                    self.transition("initialized");
                });
            },

            "openTunnel": function(port) {

                var self = this;

                new Promise(function(resolve, reject){
                    var myProcess = spawn("ssh", ["-N", "-R", port + ":localhost:9632", "kerrigan"]);
                    console.log("nodeprocess :", myProcess.pid, "myProcess: ", process.pid);

                    myProcess.stderr.on("data", function(chunkBuffer){
                        var message = chunkBuffer.toString();
                        console.log("=> " + message);
                        if (message.indexOf("Warning: remote port forwarding failed for listen port") !== -1){
                            reject({process: myProcess, msg:"Port already in use."});
                        }
                    });
                    // if no error after SSH_TIMEOUT then validate the connexion
                    setTimeout(function(){resolve(myProcess)}, SSH_TIMEOUT);

                })
                .then(function(process){
                    self.sshProcess = process;
                    // self.transition( "3G_tunnel" );
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not make the tunnel. Cleanning...");
                    self.cleanProcess(err.process);
                });
            },

            "closeTunnel": function() {

                this.cleanProcess(this.sshProcess)
                .then(function(){
                    console.log('SSH tunnel closed');
                });
            }

        }
    }
});

module.exports = dongle;
