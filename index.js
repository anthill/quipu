"use strict";

var SerialPort = require("serialport").SerialPort;
var machina = require('machina');
var spawn = require('child_process').spawn;
var Promise = require('es6-promise').Promise;

var activateSMS = require('./activateSMS.js');

var CONNECTION_TIMOUT = 20 * 1000;
var SSH_TIMEOUT = 3 * 1000;
var QUERY_TIMOUT = 10*1000;
var DEBUG = true;

var debug = function() {
    if (DEBUG)
        console.log.apply(console, arguments);
}

function cleanProcess(process){
    console.log('Stopping process...');

    return new Promise(function(resolve, reject){
        console.log('killing process id', process.pid);
        process.kill();
        process.on('exit', function(code){
            console.log('Process killed');
            resolve(code);
        });
    });
}

function openPorts(device, baudrate){
    var ports = {};

    return new Promise(function(resolve, reject){

        // open sms Port
        ports.sms = new SerialPort(device.sms, {
            baudrate: baudrate ? baudrate : 9600
        });

        ports.sms.on("open", function() {
            console.log('SMS port opened');

            // open modem Port
            ports.modem = new SerialPort(device.modem, {
                baudrate: baudrate ? baudrate : 9600 
            });

            ports.modem.on("open", function(){
                console.log('Modem port opened');
                resolve(ports);
            });

            ports.modem.on("error", function(error){
                reject(error);
            });

        });

        ports.sms.on("error", function(error){
            reject(error);
        });
    });
} 





module.exports = function(device){

    return new machina.Fsm({

        portsP: undefined,
        pppProcess: null,
        sshProcess: null,
        signalStrength: undefined,

        initialize: function() {

            var self = this;

            self.portsP = new Promise(function(resolve, reject){
                openPorts(device)
                .then(function(ports){

                    ports.sms.write("ATE1\r"); // echo mode makes easier to parse responses
                    ports.sms.write("AT+CMEE=2\r"); // more error
                    ports.sms.write("AT+CNMI=2,1,0,2,0\r"); // to get notification when messages are received

                    // listen to sms
                    ports.sms.on('data', function(data) {

                        var message = data.toString().trim();
                        debug("Raw AT message:\n", data.toString());
                        if(message.slice(0,5) === "+CMTI"){
                            ports.sms.write('AT+CPMS="ME"\r');
                            ports.sms.write('AT+CMGR=0\r');
                        }
                        if(message.slice(0, 5) === "+CMGR"){
                            var parts = message.split(/\r+\n/);
                            var from = parts[0].split(",")[1].replace(new RegExp('"', "g"), "");
                            var body = parts[1];
                            self.emit("smsReceived", {body: body, from: from});
                        }
                        if(message.slice(0, 5) === "^RSSI"){
                            try {
                                var level = message.match(/:\s(\d+)/)[1];
                                self.signalStrength = parseInt(level);
                            } catch(err){
                                console.log(err)
                            }
                        }
                    });

                    resolve(ports);

                })
                .catch(function(err){
                    console.log(err);
                    console.log("Could not open ports");
                    reject(err);
                });
            });
        },

        sendSMS: function(message, phone_no){

            this.portsP
            .then(function(ports){
                ports.sms.write("AT+CMGF=1\r");
                ports.sms.write('AT+CMGS="' + phone_no + '"\r');
                ports.sms.write(message); 
                ports.sms.write(Buffer([0x1A]));
                ports.sms.write('^z');
            })
            .catch(function(err){
                console.log(err);
            });
            
        },


        initialState: "initialized", 

        states: {

            "initialized": {
                _onEnter : function () {
                    this.handle("sendAT", "ATE1"); // echo mode makes easier to parse responses
                    this.handle("sendAT", "AT+CMEE=2"); // more error
                    this.handle("sendAT", "AT+CNMI=2,1,0,2,0"); // to get notification when messages are received
                    console.log('INITIALIZED', this.smsPort);
                },

                "connect3G": function() {

                    var self = this;

                    new Promise(function(resolve, reject){

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
                            debug("Starting ppp");
                            var myProcess = spawn("pppd", [ "debug", "-detach", "defaultroute", self.modemDeviceName, "38400"]);
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
                _onEnter: function(queenPort, antPort) {
                    console.log('3G CONNECTED');
                    this.handle('openTunnel', queenPort, antPort);
                },

                _onExit: function(){
                    var self = this;

                    // disconnect 3G
                    self.modemPort.write("AT+CGACT=0,1\r");
                    self.modemPort.write("AT+CGATT=0\r");

                    self.cleanProcess(self.pppProcess) // clean ppp process
                    .then(function(){
                        self.transition("initialized");
                    });
                },

                "openTunnel": function(queenPort, antPort) {

                    var self = this;

                    new Promise(function(resolve, reject){
                        var myProcess = spawn("ssh", ["-N", "-R", queenPort + ":localhost:" + antPort, "kerrigan"]);
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
                        self.transition('tunnelling');
                    })
                    .catch(function(err){
                        console.log(err.msg);
                        console.log("Could not make the tunnel. Cleaning...");
                        self.cleanProcess(err.process);
                    });
                },

                "disconnect3G": function() {
                    var self = this;

                    self.modemPort.write("AT+CGACT=0,1\r");
                    self.modemPort.write("AT+CGATT=0\r");

                    self.cleanProcess(self.pppProcess)
                    .then(function(code){
                        self.transition("initialized");
                    });
                }
            },

            "tunnelling": {
                _onEnter: function(){
                    console.log('TUNNELLING');
                    this.sendSMS('tunnelling', '+33643505643');
                },

                "closeTunnel": function() {
                    console.log('Closing SSH tunnel');

                    this.cleanProcess(this.sshProcess)
                    .then(function(){
                        console.log('SSH tunnel closed');
                        self.handle('disconnect3G');
                    });
                },

                "disconnect3G": function(){
                    this.deferUntilTransition("3G_connected");
                    this.transition('3G_connected');
                }

            }
        },


        // You can use these functions from the outside

        sendAT: function(port, command){
            if (port.isOpen())
                port.write(command + "\r");
            else
                console.log('Port ' + port + ' is not open');
        },

        // initialize: function(devices){
        //     this.handle('initialize', devices);
        // },

        openSSH: function(){ // not clear with the tunnel opening
            this.handle('connect3G');
        },

        closeSSH: function(){ // not clear with the 3G disconnection 
            this.handle('closeTunnel');
        }


    });
}
