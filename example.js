"use strict";

var quipu = require("./index.js");


var devices = {
	modem: "dev/ttyUSB0",
	sms: "dev/tty/USB2"
};

quipu.handle("initialize", devices);

quipu.on("smsReceived", function(sms){
	console.log(sms);
});

quipu.handle("connect3G");

module.exports = quipu;



// module.exports = quipu;
// quipu.handle("sendSMS", "ehehe", "33671358943");





// tests to set modem in 3G and ppp



// setTimeout(function(){
//     quipu.handle("openTunnel");
// }, 10000);







// to monitor what is going on

// quipu.on("*", function (eventName, data){
//     console.log("this thing happened:", eventName);
// });

// quipu.on("transition", function (data){
//     console.log("we just transitioned from " + data.fromState + " to " + data.toState);
// });