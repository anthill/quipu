'use strict';


function _watch(port){

    return function(){
        port.on('data', function(data) {

            var message = data.toString().trim();
            console.log(data.toString());
            if(message.slice(0,5) === "+CMTI"){
                port.write('AT+CPMS="ME"\r');
                port.write('AT+CMGR=0\r');
            }
            if(message.slice(0, 5) === "+CMGR"){
                var parts = message.split(/\r+\n/);
                var from = parts[0].split(",")[1].replace(new RegExp('"', "g"), "");
                var body = parts[1]
                self.emit("smsReceived", {body: body, from: from});
            }
        });
    }
}

function _send(port){

    return function(message, phone_no){

        if (port.isOpen()){
            port.write("AT+CMGF=1\r");
            port.write('AT+CMGS="' + phone_no + '"\r');
            port.write(message); 
            port.write(Buffer([0x1A]));
            port.write('^z');
        }
        else
            console.log('SMS port is not open'); 
    }
}

function _readAll(port){

    return function(){

        if (port.isOpen()){
            port.write("AT+CMGF=1\r");
            port.write('AT+CMGL="ALL"\r');
        }
        else
            console.log('SMS port is not open');
    }
}

function _readUnread(port){

    return function(){
        if (port.isOpen()){
            port.write("AT+CMGF=1\r");
            port.write('AT+CMGL="REC UNREAD"\r');
        }
        else
            console.log('SMS port is not open');
    }
}

module.exports = {
    watch: _watch,
    send: _send,
    readAll: _readAll,
    readUnread: _readUnread
};
