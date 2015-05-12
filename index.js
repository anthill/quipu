"use strict";

var SerialPort = require("serialport").SerialPort
var machina = require('machina');

var parseATResponse = require('./parseATResponse.js');

var dongle = new machina.Fsm({

    serialPort: undefined,

    initialState: "uninitialized",

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
				this.handle("readUnreadSMS");
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
            "connect": function() {
                this.handle("sendAT", "AT+CGATT=1");
                this.handle("sendAT", "ATH");
                this.handle("sendAT", 'AT+CGDCONT=1,"IP","free"');
                this.handle("sendAT", "AT+CGACT=1,1");
                this.handle("sendAT", 'AT+CGDATA="PPP",1');
                this.handle("sendAT", "ATD*99***1#");
                this.transition("connected");                
            }
        },

        "connected": {
            "disconnect": function() {
                this.handle("sendAT", "AT+CGACT=0,1");
                this.handle("sendAT", "AT+CGATT=0");
                this.transition("initialized"); 
            }

        }
    }
});



module.exports = dongle;


