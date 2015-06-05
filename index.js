"use strict";

var SerialPort = require("serialport").SerialPort;
var machina = require('machina');
var spawn = require('child_process').spawn;
var Promise = require('es6-promise').Promise;

var activateSMS = require('./activateSMS.js');

var CONNECTION_TIMOUT = 20 * 1000;
var SSH_TIMEOUT = 3 * 1000;
var QUERY_TIMOUT = 10*1000;


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

function openPorts(devices, baudrate){
    var ports = {};

    return new Promise(function(resolve, reject){

        // open sms Port
        ports.sms = new SerialPort(devices.sms, {
            baudrate: baudrate ? baudrate : 9600
        });

        ports.sms.on("open", function() {
            console.log('SMS port opened');

            // open modem Port
            ports.modem = new SerialPort(devices.modem, {
                baudrate: baudrate ? baudrate : 9600 
            });

            ports.modem.on("open", function(){
                console.log('Modem port opened');
                resolve(ports);
            });

            ports.modem.on("error", function(){
                reject();
            });

        });

        ports.sms.on("error", function(){
            reject();
        });
    });
} 



var dongle = new machina.Fsm({

    smsDevice: undefined,
    modemDevice: undefined,
    smsPort: undefined,
    modemPort: undefined,
    pppProcess: null,
    sshProcess: null,

    // these SMS functionalities will be initialized later by enableSMS function
    sendSMS: undefined,
    readUnreadSMS: undefined,
    readAllSMS: undefined,

    enableSMS: function(port){

        if (port.isOpen()){
            this.sendSMS = activateSMS.send(port);
            this.watchSMS = activateSMS.watch(port);
            this.readUnreadSMS = activateSMS.readUnread(port);
            this.readAllSMS = activateSMS.readAll(port);
        }
        else
            console.log('Port ' + port + ' is not open');
    },


    initialState: "uninitialized", 

    states: {
        "uninitialized": {
            "*": function() {
                this.deferUntilTransition("initialized");
            },
            "initialize": function(devices, baudrate) {

                var self = this;
                this.smsDevice = devices.sms;
                this.modemDevice = devices.modem;

                openPorts(devices)
                .then(function(ports){
                    self.smsPort = ports.sms;
                    self.modemPort = ports.modem;

                    self.enableSMS(self.smsPort);

                    // all this was in _onEnter of "initialized" state, but i believe it belongs here
                    self.watchSMS();

                    self.smsPort.write("ATE1\r"); // echo mode makes easier to parse responses
                    self.smsPort.write("AT+CMEE=2\r"); // more error
                    self.smsPort.write("AT+CNMI=2,1,0,2,0\r"); // to get notification when messages are received

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
                console.log('INITIALIZED, listening to SMS');
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

    initialize: function(devices){
        this.handle('initialize', devices);
    },

    openSSH: function(){ // not clear with the tunnel opening
        this.handle('connect3G');
    },

    closeSSH: function(){ // not clear with the 3G disconnection 
        this.handle('closeTunnel');
    }

    // You can also use 
    // * sendSMS(message, phone_no)
    // * watchSMS()
    // * readAllSMS()
    // * readUnreadSMS()

});

module.exports = dongle;
