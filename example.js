"use strict";

var quipu = require("./index.js");


quipu.handle("initialize", "/dev/tty.HUAWEIMobile-Modem");
// quipu.handle("sendSMS", "ehehe", "33671358943");

quipu.on("ATresponse", function(res){
	console.log(res);
})


quipu.handle("sendAT", 'AT+CSCA?');
// // test to read sms
// quipu.handle("sendAT", 'AT+CNMI=?');
// quipu.handle("sendAT", 'AT+CMGL=?');
// quipu.handle("sendAT", 'AT+CNMI=1,2,0,0,0');
// quipu.handle("readAllSMS");


// tests to set modem in 3G and ppp
// quipu.handle("sendAT", "AT+CPMS=?");
// quipu.handle("sendAT", "AT+CGREG?");
// quipu.handle("sendAT", "AT+COPS?");
// quipu.handle("sendAT", "AT+CSQ");
// quipu.handle("sendAT", "AT+cgatt=1");
// quipu.handle("sendAT", "ATH");
// quipu.handle("sendAT", "ATE1");
// quipu.handle("sendAT", 'AT+CGDCONT=1,"IP","free"');
// quipu.handle("sendAT", "AT+CGACT=1,1");
// quipu.handle("sendAT", 'AT+CGDATA="PPP",1');
// quipu.handle("sendAT", "ATD*99***1#");

// setTimeout(function(){
//     quipu.handle("sendAT", "AT+CGACT=0,1");
// 	quipu.handle("sendAT", "AT+CGATT=0");	
// }, 20000);







// to monitor what is going on

// quipu.on("*", function (eventName, data){
//     console.log("this thing happened:", eventName);
// });

// quipu.on("transition", function (data){
//     console.log("we just transitioned from " + data.fromState + " to " + data.toState);
// });