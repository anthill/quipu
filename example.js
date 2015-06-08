"use strict";

var quipu = require("./index.js");

// init device
var device = {
	modem: "/dev/ttyUSB0",
	sms: "/dev/ttyUSB2"
};
quipu.initialize(device);


// sending SMS
quipu.sendSMS("Hello from quipu", "33671358943");

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

// read past SMS
quipu.readAllSMS()
quipu.readUnreadSMS()



module.exports = quipu;
