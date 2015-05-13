var SerialPort = require("serialport").SerialPort
var serialPort = new SerialPort("/dev/ttyUSB0", {
     baudrate: 9600,  dataBits: 8,  parity: 'none',  stopBits: 1, flowControl: false, xon : false, rtscts:false, xoff:false, xany:false, buffersize:0
});

var commands = [
    {description : "Get the module manufacturer",
    cmd : "AT+CGMI"},

    {description : "Read the model number",
    cmd : "AT+CGMM"},

    {description : "Get the revision number",
    cmd : "AT+CGMR"},

    {description : "Get the device capabilities",
    cmd : "AT+GCAP"},

    {description : "Device profile",
    cmd : "AT&V"},

    {description : "Get the battery status",
    cmd : "AT+CBC"},

    {description : "Device functionality",
    cmd : "AT+CFUN?"},

    {description : "Device status",
    cmd : "AT+CPAS"},

    {description : "Device clock",
    cmd : "AT+CCLK?"},

    {description : "Get the device serial number",
    cmd : "AT+CGSN"},

    {description : "Character set used by the module",
    cmd : "AT+CSCS?"},

    {description : "Indicators available from the module",
    cmd : "AT+CIND=?"},

    {description : "Get the GPRS class supported by the module",
    cmd : "AT+CGCLASS?"},

    {description : "Check if any PDP context has been activated",
    cmd : "AT+CGACT?"},

    {description : "Get the IP address of the connected PDP context",
    cmd : "AT+CGPADDR= 1"},

    {description : "Get the list of PDP contexts stored in the module",
    cmd : "AT+CGDCONT?"},

    {description : " Check if the device is attached to the network",
    cmd : "AT+CGATT?"},

    {description : "Bearer configuration",
    cmd : "AT+CBST?"},

    {description : "Radio Link Protocol (RLP) paramerters",
    cmd : "AT+CRLP?"},

    {description : "USSD configuration",
    cmd : "AT+CUSD?"},

    {description : "Service reporting",
    cmd : "AT+CR?"},

    {description : "Extended error reporting",
    cmd : "AT+CEER"},

    {description : "Signal strength",
    cmd : "AT+CSQ"},

    {description : "Current network operator",
    cmd : "AT+COPS?"},

    {description : "Registration status",
    cmd : "AT+CREG?"},

    {description : "Get the available networks",
    cmd : "AT+COPS=?"},

    {description : "Preferred operator list",
    cmd : "AT+CPOL?"},

    {description : "SMS mode",
    cmd : "AT+CMGF?"},

    {description : "SMS service center address",
    cmd : "AT+CSCA?"},

    {description : "SMS support",
    cmd : "AT+CSMS?"},

    {description : "SIM card status",
    cmd : "AT+CPIN?"},

    {description : "Sysinfo is a very useful AT command that provides info about the network. ",
    cmd : "AT^SYSINFO"},

    {description : "How the module is configured for wakeup?",
    cmd : "AT^WAKEUPCFG?"},

    {description : "Get the IMEI number of the module",
    cmd : "AT^IMEISV?"},

    {description : "GPIO configuration",
    cmd : "AT^IOCTRL?"},

    {description : "Get the ICCID of the SIM card",
    cmd : "AT^ICCID?"},

    {description : "USSD mode configuration",
    cmd : "AT^USSDMODE?"},

    {description : "Echo cancellation for the audio paths",
    cmd : "AT^ECHO?"},

    {description : "PCM Audio configuration",
    cmd : "AT^CPCM?"},

    {description : "SIM Tool kit mode",
    cmd : "AT^STSF?"},

    {description : "Read the temperature",
    cmd : "AT^CHIPTEMP?"},

    {description : "Check if temperature protection is enabled",
    cmd : "AT^THERMFUN?"},

    {description : "Get the NDIS connection status",
    cmd : "AT^NDISSTATQRY?"},

    {description : "Voice call/data call preference",
    cmd : "AT^DVCFG?"},

    {description : "IP configuration status",
    cmd : "AT^IPINIT?"},

    {description : "Check if any IP connections are opened",
    cmd : "AT^IPOPEN?"},

    {description : "Check if the module is listening to any ports",
    cmd : "AT^IPLISTEN?"},

    {description : "Configure IP static parameters",
    cmd : "AT^IPCFL?"},

    {description : "Get IP data statistics",
    cmd : "AT^IPFLOWQ?"},

    {description : "GPS Operation Mode",
    cmd : "AT^WPDOM?"},

    {description : "GPS positioning setting",
    cmd : "AT^WPDST?"},

    {description : "GPS QoS",
    cmd : "AT^WPQOS?"},

    {description : "GPS session lock",
    cmd : "AT^WPDGL?"},

    {description : "Supported GPS types",
    cmd : "AT^GPSTYPE?"},

    {description : "GNSS or GPS mode",
    cmd : "AT^WGNSS?"},

    {description : "FOTA mode",
    cmd : "AT^FOTAMODE?"},

    {description : "FOTA configuration",
    cmd : "AT^FOTACFG?"},

    {description : "FOTA state",
    cmd : "AT^FOTASTATE?"}
];

commands = [
    {description : "",
    cmd : "AT+CMGF?"},

    // {description: "eee",
    // cmd : "AT+CMGF=1"},

    // {description : "",
    // cmd : "AT+CSCA?"},

    // {description : "",
    // cmd : "AT+CSMS?"}

    // {description:"",
    // cmd : "AT^SYSCFG?"},

    // {description : "",
    // cmd : "AT+CMGF?"}
]



serialPort.on("open", function () {
    console.log('Serial communication open');

    serialPort.on('data', function(data) {
        console.log("Received data: " + data);
    });
    serialPort.on('error', function(err) {
        console.log("Received error: " + err);
    });

    commands.forEach(function(command){
        console.log(command.description)
        serialPort.write(command.cmd + "\r");
    });
    


});


