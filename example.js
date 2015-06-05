"use strict";

var quipu = require("./index.js");


var devices = {
	modem: "/dev/ttyUSB0",
	sms: "/dev/ttyUSB2"
};

quipu.initialize(devices);

quipu.on("smsReceived", function(sms){
	console.log(sms);
	if (sms.body === 'open ssh' && sms.from === '+33643505643'){
		quipu.openSSH();
	}

	if (sms.body === 'close ssh' && sms.from === '+33643505643'){
		quipu.closeSSH();
	}
		
});

module.exports = quipu;
