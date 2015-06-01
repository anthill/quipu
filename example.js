"use strict";

var quipu = require("./index.js");


quipu.handle("initialize", "/dev/ttyUSB0");
// quipu.handle("sendSMS", "ehehe", "33671358943");

quipu.on("smsReceived", function(sms){
	console.log(sms);
})



// tests to set modem in 3G and ppp

quipu.handle("connect3G");

setTimeout(function(){
    quipu.handle("disconnect3G");
}, 30000);







// to monitor what is going on

// quipu.on("*", function (eventName, data){
//     console.log("this thing happened:", eventName);
// });

// quipu.on("transition", function (data){
//     console.log("we just transitioned from " + data.fromState + " to " + data.toState);
// });