"use strict";


var isATCommand = function(line) {
	return line.slice(0, 2) === "AT";
};

var isOKCommand = function(line) {
	return line === "OK";
};

module.exports = function parseATResponse(message) {

	var parts = message.toString().split(/\r+\n/);
	console.log("========================")
	console.log(message.toString())
	var cmd;
	var results = [];
	var globalOutput = []; // there can be multiple command output in one message
	var parsingCommand = false;

	var partsF = parts.filter(function(line){return line !== ""})
		partsF.forEach(function(line, index){

			if(isATCommand(line)){
				cmd = line;
				results = [];
				parsingCommand = true;
				if (index === partsF.length)
					globalOutput.push({cmd:cmd, results:[]})
			} else if (isOKCommand(line)) {
				var output = {
					cmd: cmd,
					results: results
				}
				if (output.cmd)
					globalOutput.push(output);
				cmd = undefined;
				parsingCommand = false;
			} else {
				if (parsingCommand)
					results.push(line);
			}

		});

	return globalOutput;

};


// [ 'AT+CMGL="ALL"',
//   '+CMGL: 0,"REC READ","+33671358943",,"15/04/28,11:07:24+08"',
//   'Tu vas voir',
//   '+CMGL: 1,"REC READ","+33671358943",,"15/04/28,12:49:15+08"',
//   'Ejdbbcc',
//   '',
//   'OK',
//   'AT+CMGF=1',
//   'OK',
//   'AT+CMGS="33671358943"',
//   '> gros fils de pute\u001a^z' ]