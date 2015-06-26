"use strict";

var quipu = require("./index.js");
var PIN = require("./myPINcode.js");

// initilize the device

var devices = {
	modem: "/dev/serial/by-id/usb-HUAWEI_HUAWEI_HiLink-if00-port0",
	sms: "/dev/serial/by-id/usb-HUAWEI_HUAWEI_HiLink-if02-port0"
};

quipu.handle("initialize", devices, PIN);

quipu.on("transition", function (data){
    console.log("Transitioned from " + data.fromState + " to " + data.toState);
});

// send normal sms sms
quipu.sendSMS("1", "33671358943");
quipu.sendSMS("2", "33671358943");

// receiving normal SMS
quipu.on("smsReceived", function(sms){
	console.log(sms);		
});

// to send encoded, as sms don't like curly braces and other stuff
var parser = require("./parser.js")

parser.encode(devices)
	.then(function(msg){
		quipu.sendSMS(msg, "33671358943");
	})
	.catch(function(err){
		console.log(err);
	});
// and to decode use 
quipu.on("smsReceived", function(sms){
	parser.decode(sms.body)
		.then(function(object){
			console.log(object);
		})		
});



spawning a 3G connexion and closing it after 30 seconds
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
