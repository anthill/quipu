"use strict";

var SerialPort = require("serialport").SerialPort
var machina = require('machina');
var spawn = require('child_process').spawn;
var Promise = require('es6-promise').Promise;

var CONNECTION_TIMEOUT = 20 * 1000;
var SSH_TIMEOUT = 10 * 1000;
var QUERY_TIMOUT = 10 * 1000;
var DEBUG = process.env.DEBUG ? process.env.DEBUG : false;

var debug = function() {
    if (DEBUG) {
        [].unshift.call(arguments, "[DEBUG quipu] ");
        console.log.apply(console, arguments);
    };
}

var dongle = new machina.Fsm({

    smsDevice: undefined,
    modemDevice: undefined,
    smsPort: undefined,
    modemPort: undefined,
    pppProcess: null,
    sshProcess: null,
    signalStrength: undefined,
    registrationStatus: undefined,
    PIN: undefined,
    smsQueue: [],
    sendingSMS: false,
    modemInitializedOnce: false,
    networkType: 0,

    initialState: "uninitialized",

    getNetworkType: function() {
        return dongle.networkType;
    },

    askNetworkType: function() {
        debug("asking for the network type");
        this.smsPort.write("AT^SYSINFO\r");
    },

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

    openSmsPort: function(baudrate){

        var self = this;

        return new Promise(function(resolve, reject){

            // open sms Port
            self.smsPort = new SerialPort(self.smsDevice, {
                baudrate: baudrate ? baudrate : 9600
            });

            self.smsPort.on("open", function() {
                debug('SMS port opened');                
                resolve()
            });

            self.smsPort.on("error", function(data){
                debug("error event on smsPort", data);
                reject();
            });
        });    
    },

    openModemPort: function(baudrate){

        var self = this;

        return new Promise(function(resolve, reject){

            self.modemPort = new SerialPort(self.modemDevice, {
                baudrate: baudrate ? baudrate : 9600 
            });

            self.modemPort.on("open", function(){
                debug('Modem port opened');
                resolve();
            });

            self.modemPort.on("error", function(data){
                debug("error event on modemPort", data);
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

    sendSMS: function(message, phone_no) {
        // add sms to queue and check if it can be sent
        this.smsQueue.push({message: message, phone_no: phone_no});
        if (!this.sendingSMS && this.smsPort.isOpen()) {
            this.sendingSMS = true;
            var toSend = this.smsQueue.shift();
            this._sendSMS(toSend.message, toSend.phone_no);
        }
    },

    _sendSMS: function(message, phone_no) {
        this.smsPort.write("AT+CMGF=1\r");
        this.smsPort.write('AT+CMGS="' + phone_no + '"\r');
        this.smsPort.write(message); 
        this.smsPort.write(Buffer([0x1A]));
        this.smsPort.write('^z');
    },

    watchATonSms: function(){
        var self = this;

        self.smsPort.on('data', function(data) {

            var message = data.toString().trim();
            debug("Raw AT message from sms:\n", data.toString());
            // sms received notifications
            if(message.slice(0,5) === "+CMTI"){
                var mesgNum = message.match(/,(\d+)/)[1];
                debug("received a sms at position ", mesgNum);
                self.smsPort.write("AT+CMGF=1\r");
                self.smsPort.write('AT+CPMS="ME"\r');
                self.smsPort.write('AT+CMGR=' + mesgNum +'\r');
            }
            // sms received content
            if(message.slice(0, 5) === "+CMGR"){
                self.smsPort.write("AT+CMGF=1\r");
                var parts = message.split(/\r+\n/);
                var from = parts[0].split(",")[1].replace(new RegExp('"', "g"), "");
                var body = parts[1];
                setTimeout(function(){
                    self.smsPort.write("AT+CMGD=0,2\r");
                }, 5000)
                
                self.emit("smsReceived", {body: body, from: from});
            }
            // sms sent
            if(message.indexOf("+CMGS: ") > -1){
                debug("Message sent");
                // try to send next message in queue
                if (self.smsQueue.length > 0){
                    var toSend = self.smsQueue.shift();
                    self._sendSMS(toSend.message, toSend.phone_no);
                } else {
                    self.sendingSMS = false;
                }
            }
            // memory full
            if(message.indexOf("SMMEMFULL") > -1){
                debug("Memory full");
                self.smsPort.write("AT+CMGD=0,4\r");
            }
            // signal strength
            if(message.slice(0, 5) === "^RSSI"){
                try {
                    var level = message.match(/:\s(\d+)/)[1];
                    self.signalStrength = parseInt(level);
                } catch(err){
                    console.log("error in watchATmsg for rssi", err);
                }
            }
            // registration (see http://m2msupport.net/m2msupport/atcreg-network-registration/)
            if(message.slice(0, 5) === "+CREG"){
                try {
                    var level = message.match(/:\s(\d+)/)[1];
                    self.registrationStatus = parseInt(level);
                } catch(err){
                    console.log("error in watchATmsg for CREG", err);
                }
            }
            // network type (EDGE, 3G, 3G+)
            if (message.match(/SYSINFO:\d,\d,\d,\d,\d,\d,(\d)/)) {
                dongle.networkType = parseInt(message.match(/SYSINFO:\d,\d,\d,\d,\d,\d,(\d)/)[1]);
                debug("networkType : " + dongle.networkType);
            }
        });
    },

    watchATonModem: function(){
        var self = this;
        var connected = false;
        // listening for the modem CONNECT message that should trigger ppp
        self.modemPort.on('data', function(data) {
            var message = data.toString().trim();
            debug("Raw AT message from modem:\n", data.toString());
        
            if(message.indexOf("CONNECT") > -1){
                self.emit("connectReceived");
            }
        });

        if (!self.modemInitializedOnce) {
            self.modemInitializedOnce = true;

            // listening for the modem ready trigger
            self.on("connectReceived", function(){
                var resolved = false;
                connected = true;
                console.log("Starting ppp");
                var myProcess = spawn("pppd", [ "debug", "-detach", "defaultroute", self.modemDevice, "38400"]);
                myProcess.stdout.on("data", function(chunkBuffer){
                    var message = chunkBuffer.toString();
                    debug("ppp stdout => " + message);
                    if (message.indexOf("local  IP address") > -1){
                        resolved = true;
                        self.emit("pppConnected", myProcess);
                    } else if (message.indexOf("Modem hangup") > -1){
                        debug("Modem hanged up, disconnecting.");
                        self.emit("pppError", {process: myProcess, msg:"Modem hanged up, disconnecting."});
                    }
                });
                // if the connection is not established after CONNECTION_TIMEOUT reject
                setTimeout(function(){
                    if (!resolved)
                        self.emit("pppError", {process: myProcess, msg:"Request time out."})
                }, CONNECTION_TIMEOUT);
            });

            self.on("pppConnected", function(myProcess){
                debug("received pppConnected");
                self.pppProcess = myProcess;
                self.transition("3G_connected");
            });

            self.on("pppError", function(msg){
                debug("received pppError");
                self.cleanProcess(msg.process)
                    .then(function() {self.emit("3G_error")});
            });

            setTimeout(function(){
                if (!connected)
                    self.emit("3G_error");
                }, CONNECTION_TIMEOUT);

        }
    },


    states: {
        "uninitialized": {
            "*": function() {
                this.deferUntilTransition("initialized");
            },
            "initialize": function(devices, PIN, baudrate) {

                var self = this;
                self.smsDevice = devices.sms;
                self.modemDevice = devices.modem;
                self.PIN = PIN;

                self.openSmsPort()
                    .then(function(){

                        self.watchATonSms();
                        self.smsPort.write("ATE1\r"); // echo mode makes easier to parse responses
                        self.smsPort.write("AT+CMEE=2\r"); // more error
                        
                        self.smsPort.write("AT+CPIN=" + self.PIN + "\r");

                        self.smsPort.write("AT+CNMI=2,1,0,2,0\r"); // to get notification when messages are received
                        self.smsPort.write("AT+CMGF=1\r"); // text mode for sms
                        self.smsPort.write("AT+CMGD=0,4\r");
                        // self.modemPort.write("AT+CMGF=1\r"); // text mode for sms
                        // self.modemPort.write("AT+CREG=1\r"); //

                        if (self.smsQueue.length > 0){
                            var toSend = self.smsQueue.shift();
                            self._sendSMS(toSend.message, toSend.phone_no);
                        };
                        
                        setTimeout(function(){
                            self.transition("initialized", PIN);
                        }, 2000);
                    })
                    .catch(function(err){
                        console.log("error in initialize", err);
                        console.log("Could not open sms port");
                    });
            },
        },
        "initialized": {
            _onEnter: function(){
                debug('INITIALIZED');
            },
            "open3G": function(apn) {

                var self = this;

                self.openModemPort()
                    .then(function(){

                        self.watchATonModem();                            
                        self.modemPort.write('ATH\r');
                        self.modemPort.write("ATE1\r");
                        self.modemPort.write('AT+CGDCONT=1,"IP","' + (apn ? apn : 'free') + '"\r');
                        self.modemPort.write("ATD*99#\r");
                    })
                    .catch(function(err){
                        console.log("error in initialize", err.msg);
                        console.log("Could not open modem port");
                    });
            }
        },

        "3G_connected": {
            _onEnter : function () {
                console.log('3G CONNECTED');
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
                    var myProcess = spawn("ssh", ["-v", "-N", "-R", queenPort + ":localhost:" + antPort, target]);
                    debug("nodeprocess :", myProcess.pid, "myProcess: ", process.pid);
                    myProcess.stderr.on("data", function(chunkBuffer){
                        var message = chunkBuffer.toString();
                        debug("ssh stderr => " + message);
                        if (message.indexOf("remote forward success") !== -1){
                            resolve(myProcess);
                        } else if (message.indexOf("Warning: remote port forwarding failed for listen port") !== -1){
                            reject({process: myProcess, msg:"Port already in use."});
                            self.emit("3G_error");
                        }
                    });
                    // if no error after SSH_TIMEOUT 
                    setTimeout(function(){reject({process: myProcess, msg:"SSH timeout"});}, SSH_TIMEOUT);

                })
                .then(function(process){
                    self.sshProcess = process;
                    self.transition( "tunnelling" );
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not make the tunnel. Cleanning...");
                    self.cleanProcess(err.process);
                    self.emit("tunnelError", err.msg);
                });
            }

        },

        "tunnelling": {
            _onEnter: function(){
                debug('TUNNELLING');
            },
            "closeTunnel": function() {
                debug('Closing SSH tunnel');

                this.cleanProcess(this.sshProcess)
                debug('SSH tunnel closed');
                this.transition('3G_connected');
            },

            "close3G": function(){
                var self = this;
                debug('Closing SSH tunnel');

                this.cleanProcess(this.sshProcess)
                debug('SSH tunnel closed');

                self.modemPort.write("AT+CGACT=0,1\r");
                self.modemPort.write("AT+CGATT=0\r");

                self.cleanProcess(self.pppProcess)
                // the killing of ssh doesn't emit exit 
                self.transition("initialized");
            }

        }
    }
});

module.exports = dongle;
