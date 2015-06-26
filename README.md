# Quipu

This modules provides SMS and 3G functionnalities in node.js.

From [Wikipedia article](http://en.wikipedia.org/wiki/Quipu):
"A quipu usually consisted of colored, spun, and plied thread or strings made from cotton or camelid fiber. For the Inca, the system aided in collecting data and keeping records, ranging from monitoring tax obligations, properly collecting census records, calendrical information, and military organization."

## Getting started

After creating a file called `myPINcode.js` containing `module.exports = xxxx;` your pin code, you can use the library as follows: 

```js
var quipu = require("./index.js");

// initilize the device
var yourNumber = "336........";
var devices = {
    modem: "/dev/ttyUSB0",
    sms: "/dev/ttyUSB2"
};

quipu.handle("initialize", devices);

// sending a SMS
quipu.sendSMS("Hello from quipu.", yourNumber);

// receiving SMS
quipu.on("smsReceived", function(sms){
    console.log(sms);       
});

// spawning a 3G connexion and closing it after 30 seconds
quipu.handle("open3G");

setTimeout(function(){
    quipu.handle("close3G");
}, 30000)


// open a reverse ssh tunnel towards "kerrigan" (must be set in your ~/.ssh/config)
quipu.handle("openTunnel", 2222, 9632, "kerrigan");

setTimeout(function(){
    quipu.handle("closeTunnel");
}, 30000)

```

Behind the scene, there is a final state machine (FSM) with the following states:

![States of quipu](https://docs.google.com/drawings/d/103BZlfPiCt5CTqBepyA6QTmN5B-ivCOfwhd735zRj5Y/pub?w=960&h=720)

## Compressing messages

160 characters is not a lot and you have useful characters like curly braces that ar not well handeled by sms protocol. So `parser.js` provides and `encode` and `decode` functions that can help you **pass json objects through the air**:

```
// to send encoded, as sms don't like curly braces and other stuff
var parser = require("./parser.js")

parser.encode(devices)
    .then(function(msg){
        quipu.sendSMS(msg, yourNumber);
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
```

### References

AT commands:

- [Command description](http://m2msupport.net/m2msupport/atclck-facility-lock/)
- [Parsing](http://www.codeproject.com/Articles/85636/Introduction-to-AT-commands-and-its-uses)

SMS format:

- [the bible](http://www.developershome.com/sms/)
- [sending sms and change modem mode](https://myraspberryandme.wordpress.com/2013/09/13/short-message-texting-sms-with-huawei-e220/)
- [receiving sms](http://www.smssolutions.net/tutorials/gsm/receivesmsat/)
- [PDU](https://github.com/emilsedgh/pdu)
- [GSM error codes](http://www.smssolutions.net/tutorials/gsm/gsmerrorcodes/)

PPP:

- [Huawei_3G_modem_on_Ubuntu](http://www.crashcourse.ca/wiki/index.php/Huawei_3G_modem_on_Ubuntu)
- [3G and ppp](https://wiki.archlinux.org/index.php/3G_and_GPRS_modems_with_pppd)
- [reference](http://www.tldp.org/HOWTO/PPP-HOWTO/x761.html)
- [10 min guide](http://www.linuxjournal.com/article/2109?page=0,0)


