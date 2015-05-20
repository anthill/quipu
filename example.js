"use strict";

var dongle = require("./index.js");


dongle.handle("initialize", "/dev/tty.HUAWEIMobile-Modem");
// dongle.handle("sendSMS", "ehehe", "33671358943");

dongle.on("ATresponse", function(res){
	console.log(res);
})


dongle.handle("sendAT", 'AT+CSCA?');
// // test to read sms
// dongle.handle("sendAT", 'AT+CNMI=?');
// dongle.handle("sendAT", 'AT+CMGL=?');
// dongle.handle("sendAT", 'AT+CNMI=1,2,0,0,0');
// dongle.handle("readAllSMS");


// tests to set modem in 3G and ppp
// dongle.handle("sendAT", "AT+CPMS=?");
// dongle.handle("sendAT", "AT+CGREG?");
// dongle.handle("sendAT", "AT+COPS?");
// dongle.handle("sendAT", "AT+CSQ");
// dongle.handle("sendAT", "AT+cgatt=1");
// dongle.handle("sendAT", "ATH");
// dongle.handle("sendAT", "ATE1");
// dongle.handle("sendAT", 'AT+CGDCONT=1,"IP","free"');
// dongle.handle("sendAT", "AT+CGACT=1,1");
// dongle.handle("sendAT", 'AT+CGDATA="PPP",1');
// dongle.handle("sendAT", "ATD*99***1#");

// setTimeout(function(){
//     dongle.handle("sendAT", "AT+CGACT=0,1");
// 	dongle.handle("sendAT", "AT+CGATT=0");	
// }, 20000);







// to monitor what is going on

// dongle.on("*", function (eventName, data){
//     console.log("this thing happened:", eventName);
// });

// dongle.on("transition", function (data){
//     console.log("we just transitioned from " + data.fromState + " to " + data.toState);
// });