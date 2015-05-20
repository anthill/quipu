"use strict";

var SerialPort = require("serialport").SerialPort
var machina = require('machina');
var spawn = require('child_process').spawn;
var kill = require('tree-kill');
var Promise = require('es6-promise').Promise;

var CONNECTION_TIMOUT = 20 * 1000;
var SSH_TIMEOUT = 3 * 1000;
var QUERY_TIMOUT = 10*1000;

var parseATResponse = require('./parseATResponse.js');

var dongle = new machina.Fsm({

    serialPort: undefined,
    wvdialPid: null,
    sshPid: null,

    initialState: "uninitialized",



    cleanProcess: function(pid){

        var self = this;
        pid = pid || self.wvdialPid;
        console.log("Cleaning pid ", pid);
        if (pid > 0){
            kill(pid, 'SIGKILL');
        } else {
            console.log("could not kill signal whose pid is not an integer");
        };
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
				        var response = parseATResponse(data);
				        self.emit("ATresponse", response)
				    });
                    self.transition("initialized");
                });

            },
        },
        "initialized": {
        	_onEnter : function () {
                this.handle("sendAT", "ATE1"); // echo mode makes easier to parse responses
                this.handle("sendAT", "AT+CMEE=1 "); // more error
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
                    var myProcess = spawn("wvdial", ["3G"]);
                    console.log("nodeprocess :", myProcess.pid, "myProcess: ", process.pid);

                    myProcess.stderr.on("data", function(chunkBuffer){
                        var message = chunkBuffer.toString();
                        console.log("=> " + message);
                        if (message.indexOf("Device or resource busy") !== -1){
                            setTimeout(function(){reject({pid: myProcess.pid, msg:"Ressource busy."})}, CONNECTION_TIMOUT);
                        } else if (message.indexOf("The PPP daemon has died") !== -1){
                            setTimeout(function(){reject({pid: myProcess.pid, msg:"PPP died."})}, CONNECTION_TIMOUT);
                        } else if (message.indexOf("local  IP address") !== -1){
                            resolve(myProcess.pid);
                        } else {
                            setTimeout(function(){reject({pid: myProcess.pid, msg:"Request time out."})}, CONNECTION_TIMOUT);
                        }
                    });
                })
                .then(function(pid){
                    self.wvdialPid = pid;
                    self.transition( "3G_connected" );
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not connect. Cleanning...");
                    self.cleanProcess(err.pid);
                });

                
            },
        },

        "3G_connected": {
            "disconnect": function() {
                var self = this;
                self.cleanProcess(self.wvdialPid);
                self.transition( "initialized" );
            },

            "makeTunnel": function(port) {

                var self = this;

                new Promise(function(resolve, reject){
                    var myProcess = spawn("ssh", ["-N", "-R", port + ":localhost:22", "ants"]);
                    console.log("nodeprocess :", myProcess.pid, "myProcess: ", process.pid);

                    myProcess.stderr.on("data", function(chunkBuffer){
                        var message = chunkBuffer.toString();
                        console.log("=> " + message);
                        if (message.indexOf("Warning: remote port forwarding failed for listen port") !== -1){
                            reject({pid: myProcess.pid, msg:"Port already in use."});
                        }
                    });
                    // if no error after SSH_TIMEOUT then validate the connexion
                    setTimeout(function(){resolve(myProcess.pid)}, SSH_TIMEOUT);

                })
                .then(function(pid){
                    self.sshPid = pid;
                    self.transition( "3G_tunnel" );
                    resolve1("SUCCESS");
                })
                .catch(function(err){
                    console.log(err.msg);
                    console.log("Could not make the tunnel. Cleanning...");
                    self.cleanProcess(err.pid)
                });


            },

        }
    }
});



module.exports = dongle;


