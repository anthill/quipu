"use strict";

var quipu = require("./index.js");

// initilize the device

var devices = {
	modem: "/dev/ttyUSB0",
	sms: "/dev/ttyUSB2"
};

quipu.handle("initialize", devices);

// sending a SMS
quipu.handle("sendSMS", "Hello from quipu.", "33671358943");

// receiving SMS
quipu.on("smsReceived", function(sms){
	console.log(sms);		
});

// spawning a 3G connexion and closing it after 30 seconds
quipu.handle("open3G");

setTimeout(function(){
	quipu.handle("close3G");
}, 30000)


// open a reverse ssh tunnel towards "kerrigan" (must be set in your ~/.ssh/config)
quipu.handle("openTunnel", 2222, 9632, "kerrigan");

setTimeout(function(){
	quipu.handle("closeTunnel");
}, 30000)



module.exports = quipu;
