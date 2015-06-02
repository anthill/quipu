"use strict";

var SerialPort = require("serialport").SerialPort
var machina = require('machina');
var spawn = require('child_process').spawn;
var Promise = require('es6-promise').Promise;

var CONNECTION_TIMOUT = 20 * 1000;
var SSH_TIMEOUT = 3 * 1000;
var QUERY_TIMOUT = 10*1000;

var dongle = new machina.Fsm({

    device: undefined,
    serialPort: undefined,
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


    states: {
        "uninitialized": {
            "*": function() {
                this.deferUntilTransition("initialized");
            },
            "initialize": function(device, baudrate) {

                var self = this;

                self.serialPort = new SerialPort(device, {
                    baudrate: baudrate ? baudrate : 9600,  
                    dataBits: 8,  
                    parity: 'none',  
                    stopBits: 1, 
                    flowControl: false, 
                    xon : false, 
                    rtscts:false, 
                    xoff:false, 
                    xany:false, 
                    buffersize:0
                });

                self.serialPort.on("open", function () {
                	self.serialPort.on('data', function(data) {

                        var message = data.toString().trim();
                        console.log(data.toString());
                        if(message.slice(0,5) === "+CMTI"){
                            self.handle("sendAT", 'AT+CPMS="ME"');
                            self.handle("sendAT", 'AT+CMGR=0');
                        }
                        if(message.slice(0, 5) === "+CMGR"){
                            var parts = message.split(/\r+\n/);
                            var from = parts[0].split(",")[1].replace(new RegExp('"', "g"), "");
                            var body = parts[1]
                            self.emit("smsReceived", {body: body, from: from});
                        }
                        if(message.indexOf("CONNECT") > -1){
                            self.emit("connectReceived");
                        }
				    });

                    self.device = device;
                    self.transition("initialized");
                });

            },
        },
        "initialized": {
        	_onEnter : function () {
                this.handle("sendAT", "ATE1"); // echo mode makes easier to parse responses
                this.handle("sendAT", "AT+CMEE=2"); // more error
                this.handle("sendAT", "AT+CNMI=2,1,0,2,0"); // to get notification when messages are received
                console.log('INITIALIZED');
			},
            "sendSMS": function(message, phone_no) {

                this.serialPort.write("AT+CMGF=1\r");
                this.serialPort.write('AT+CMGS="' + phone_no + '"\r');
                this.serialPort.write(message); 
                this.serialPort.write(Buffer([0x1A]));
                this.serialPort.write('^z');
                
            },
            "readUnreadSMS": function() {
            	this.serialPort.write("AT+CMGF=1\r");
            	this.serialPort.write('AT+CMGL="REC UNREAD"\r');
            },
            "readAllSMS": function() {            	
            	this.serialPort.write("AT+CMGF=1\r");
            	this.serialPort.write('AT+CMGL="ALL"\r');
            },
            "sendAT": function(cmd) {
                this.serialPort.write(cmd + "\r");
            },
            "connect3G": function() {

                var self = this;

                new Promise(function(resolve, reject){


                    self.handle("sendAT", 'ATH');
                    self.handle("sendAT", "ATE1");
                    // self.handle("sendAT", "AT+CGATT=1");
                    // self.handle("sendAT", "AT+CGACT=1,1");
                    // self.handle("sendAT", 'AT+CGDATA="PPP",1');
                    self.handle("sendAT", 'AT+CGDCONT=1,"IP","free"');
                    self.handle("sendAT", "ATD*99#");

                    self.on("connectReceived", function(){
                        console.log("Starting ppp");
                        var myProcess = spawn("pppd", [ "debug", "-detach", "defaultroute", self.device, "38400"]);
                        resolve(myProcess);
                    });
                        
                })
                .then(function(process){
                    self.pppProcess = process;
                    self.transition( "3G_connected" );
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not connect. Cleanning...");
                });

                
            },
        },

        "3G_connected": {
            _onEnter : function () {
                console.log('3G CONNECTED');
            },

            "sendAT": function(cmd) {
                this.serialPort.write(cmd + "\r");
            },

            "disconnect3G": function() {
                var self = this;

                self.handle("sendAT", "AT+CGACT=0,1");
                self.handle("sendAT", "AT+CGATT=0");

                self.cleanProcess(self.pppProcess)
                .then(function(code){
                    self.transition("initialized");
                });
            },

            "openTunnel": function(port) {

                var self = this;

                new Promise(function(resolve, reject){
                    var myProcess = spawn("ssh", ["-N", "-R", port + ":localhost:9999", "ants"]);
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


