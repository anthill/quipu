"use strict";

var quipu = require("./index.js");
var PIN = require("./myPINcode.js");

// initilize the device

var devices = {
	modem: "/dev/serial/by-id/usb-HUAWEI_HUAWEI_HiLink-if00-port0",
	sms: "/dev/serial/by-id/usb-HUAWEI_HUAWEI_HiLink-if02-port0"
};

quipu.handle("initialize", devices, PIN);

// quipu.sendSMS("1", "33671358943");
// quipu.sendSMS("2", "33671358943");
// quipu.sendSMS("3", "33671358943");


// // receiving SMS
// quipu.on("smsReceived", function(sms){
// 	console.log(sms);		
// });

// spawning a 3G connexion and closing it after 30 seconds
// quipu.handle("open3G");

// setTimeout(function(){
// 	quipu.handle("close3G");
// }, 30000)

// setTimeout(function(){
// 	quipu.handle("open3G");
// }, 40000)

// setTimeout(function(){
// 	quipu.handle("close3G");
// }, 60000)

quipu.on("transition", function (data){
    console.log("************* we just transitioned from " + data.fromState + " to " + data.toState);
});

// // open a reverse ssh tunnel towards "kerrigan" (must be set in your ~/.ssh/config)
// quipu.handle("openTunnel", 2222, 9632, "kerrigan");

// setTimeout(function(){
// 	quipu.handle("closeTunnel");
// }, 30000)



module.exports = quipu;
