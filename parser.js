"use strict";

var zlib = require('zlib');

module.exports = {

    "encode": function(object){
        return new Promise(function(resolve, reject){
            zlib.deflate(JSON.stringify(object), function(err, buffer){
                if(err) 
                    reject(err); 
                else {
                    var message = buffer.toString('base64');
                    if (message.length <= 160)
                        resolve(message);
                    else
                        reject("Message too long");
                }
            });
        });
    },

    "decode": function(message){
        var buffer = new Buffer(message, 'base64');

        return new Promise(function(resolve, reject){
                zlib.inflate(buffer, function(err, buffer){
                    if(err) 
                        reject(err); 
                    else 
                        resolve(JSON.parse(buffer));
                });
            });
    }
}
