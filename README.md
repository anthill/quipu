# Graham

This modules provides modem functionnalities in node.js.

## Sending and receiving sms

```
var dongle = require("graham");

dongle.handle("initialize", "/dev/ttyUSB0");
dongle.handle("sendSMS", "Here is my text message", "33671******");
```



## References

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
- 