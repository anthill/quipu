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

                    ports.modem.write("AT+CMEE=2\r"); // more error

                    // sms port listeners
                    ports.sms.on('data', function(data) {

                        var message = data.toString().trim();
                        debug("Raw AT message from sms:\n", data.toString());
                        // sms notification
                        if(message.slice(0,5) === "+CMTI"){
                            ports.sms.write('AT+CPMS="ME"\r');
                            ports.sms.write('AT+CMGR=0\r');
                        }
                        // sms result
                        if(message.slice(0, 5) === "+CMGR"){
                            var parts = message.split(/\r+\n/);
                            var from = parts[0].split(",")[1].replace(new RegExp('"', "g"), "");
                            var body = parts[1];
                            self.emit("smsReceived", {body: body, from: from});
                        }
                        // signal strength
                        if(message.slice(0, 5) === "^RSSI"){
                            try {
                                var level = message.match(/:\s(\d+)/)[1];
                                self.signalStrength = parseInt(level);
                            } catch(err){
                                console.log(err)
                            }
                        }
                    });

                    // modem port listeners
                    ports.modem.on('data', function(data) {
                        var message = data.toString().trim();
                        debug("Raw AT message from modem:\n", data.toString());

                        if(message.indexOf("CONNECT") > -1){
                            self.emit("connectReceived");
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

        // globally available commands
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

        sendAT: function(portName, command){
            this.portsP
            .then(function(ports){
                ports[portName].write(command + "\r");
            })
            .catch(function(err){
                console.log(err);
            });
        },



        initialState: "initialized", 

        states: {

            "initialized": {

                "open3G": function() {

                    var self = this;

                    new Promise(function(resolve, reject){

                        self.sendAT("modem", 'ATH');
                        self.sendAT("modem", "ATE1");
                        self.sendAT("modem", 'AT+CGDCONT=1,"IP","free"');
                        self.sendAT("modem", "ATD*99#");

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
                },

                _onExit: function(){
                    var self = this;

                    // disconnect 3G
                    self.sendAT("modem", "AT+CGACT=0,1");
                    self.sendAT("modem", "AT+CGATT=0");

                    cleanProcess(self.pppProcess) // clean ppp process
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
                        cleanProcess(err.process);
                    });
                },

                "close3G": function() {
                    var self = this;

                    self.sendAT("modem", "AT+CGACT=0,1");
                    self.sendAT("modem", "AT+CGATT=0");

                    cleanProcess(self.pppProcess)
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

                    cleanProcess(this.sshProcess)
                    .then(function(){
                        console.log('SSH tunnel closed');
                        self.handle('3G_connected');
                    });
                },

                "close3G": function(){
                    this.deferUntilTransition("initialized");
                    this.transition('initialized');
                }

            }
        }

    });
}
