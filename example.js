"use strict";

var quipu = require("./index.js");

// init device
var device = {
	modem: "/dev/ttyUSB0",
	sms: "/dev/ttyUSB2"
};
var quipu = require("./index.js")(device);

// sending SMS
// quipu.sendSMS("Hello from quipu", "33671358943");

// receiving SMS
quipu.on("smsReceived", function(sms){
	console.log(sms);
	if (sms.body === 'open ssh' && sms.from === '+33643505643'){
		quipu.openSSH();
	}

	if (sms.body === 'close ssh' && sms.from === '+33643505643'){
		quipu.closeSSH();
	}
		
});

// spawning a 3G connexion and closing it after 10 seconds


quipu.handle("open3G");


// setTimeout(function(){
// 	console.log("Closing 3G.")
// 	quipu.handle("close3G");
// }, 10000)

module.exports = quipu;
