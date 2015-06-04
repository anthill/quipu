"use strict";

var quipu = require("./index.js");


var devices = {
	modem: "/dev/ttyUSB0",
	sms: "/dev/ttyUSB2"
};

quipu.handle("initialize", devices);

quipu.on("smsReceived", function(sms){
	console.log(sms);
	if (sms.body === 'connect3G' && sms.from === '+33643505643'){
		quipu.handle('connect3G')
		.then(function(){
			quipu.handle('openTunnel');
		});
	}

	if (sms.body === 'disconnect3G' && sms.from === '+33643505643'){
		quipu.handle('closeTunnel')
		.then(function(){
			quipu.handle('disconnect3G');
		});
	}
		
});

// quipu.handle("connect3G");

// quipu.handle("sendSMS", "ehehe", "33671358943");

// setTimeout(function(){
//     quipu.handle("openTunnel");
// }, 10000);

module.exports = quipu;
