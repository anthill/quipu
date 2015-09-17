!/bin/bash

# Config /etc/ppp/peers/fona

(test -e /etc/ppp/peers/fona && echo "/etc/ppp/peers/fona already exists") ||
(touch /etc/ppp/peers/fona &&
echo '# Example PPPD configuration for SIM908 on Archlinux-ARM.' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# MUST CHANGE: Change the -T parameter value **** to your networks APN value.' >> /etc/ppp/peers/fona;
echo '# For example if your APN is 'internet' (without quotes), the line would look like:' >> /etc/ppp/peers/fona;
echo '# connect "/usr/sbin/chat -v -f /etc/chatscripts/gprs -T internet"' >> /etc/ppp/peers/fona;
echo 'connect "/usr/sbin/chat -v -f /etc/chatscripts/gprs -T internet.mbqt.net"' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# MUST CHANGE: Uncomment the appropriate serial device for your platform below.' >> /etc/ppp/peers/fona;
echo '# For Raspberry Pi use /dev/ttyAMA0 by uncommenting the line below:' >> /etc/ppp/peers/fona;
echo '#/dev/ttyAMA0' >> /etc/ppp/peers/fona;
echo '# For BeagleBone Black use /dev/ttyO4 by uncommenting the line below:' >> /etc/ppp/peers/fona;
echo '#/dev/ttyO4' >> /etc/ppp/peers/fona;
echo '# For ODROID C1 use /dev/ttyS2 by uncommenting the line below:' >> /etc/ppp/peers/fona;
echo '/dev/ttyS2' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# Speed of the serial line.' >> /etc/ppp/peers/fona;
echo '9600' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# Assumes that your IP address is allocated dynamically by the ISP.' >> /etc/ppp/peers/fona;
echo 'noipdefault' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# Try to get the name server addresses from the ISP.' >> /etc/ppp/peers/fona;
echo 'usepeerdns' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# Use this connection as the default route to the internet.' >> /etc/ppp/peers/fona;
echo 'defaultroute' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# Makes PPPD "dial again" when the connection is lost.' >> /etc/ppp/peers/fona;
echo 'persist' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# Do not ask the remote to authenticate.' >> /etc/ppp/peers/fona;
echo 'noauth' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# No hardware flow control on the serial link with FONA' >> /etc/ppp/peers/fona;
echo 'nocrtscts' >> /etc/ppp/peers/fona;
echo '' >> /etc/ppp/peers/fona;
echo '# No modem control lines with FONA.' >> /etc/ppp/peers/fona;
echo 'local' >> /etc/ppp/peers/fona);

# Config /etc/chatscripts/gprs

(test -e /etc/chatscripts/gprs && echo "/etc/chatscripts.gprs already exists") ||
(mkdir /etc/chatscripts;
touch /etc/chatscripts/gprs &&
echo '# line option of chat(8).' >> /etc/chatscripts/gprs;
echo ' ' >> /etc/chatscripts/gprs;
echo 'ABORT           BUSY' >> /etc/chatscripts/gprs;
echo 'ABORT           VOICE' >> /etc/chatscripts/gprs;
echo 'ABORT           "NO CARRIER"' >> /etc/chatscripts/gprs;
echo 'ABORT           "NO DIALTONE"' >> /etc/chatscripts/gprs;
echo 'ABORT           "NO DIAL TONE"' >> /etc/chatscripts/gprs;
echo 'ABORT           "NO ANSWER"' >> /etc/chatscripts/gprs;
echo 'ABORT           "DELAYED"' >> /etc/chatscripts/gprs;
echo 'ABORT           "ERROR"' >> /etc/chatscripts/gprs;
echo ' ' >> /etc/chatscripts/gprs;
echo '# cease if the modem is not attached to the network yet' >> /etc/chatscripts/gprs;
echo 'ABORT           "+CGATT: 0"' >> /etc/chatscripts/gprs;
echo ' ' >> /etc/chatscripts/gprs;
echo '""				AAAAAA # init the baudrate' >> /etc/chatscripts/gprs;
echo '""              AT' >> /etc/chatscripts/gprs;
echo 'TIMEOUT         12' >> /etc/chatscripts/gprs;
echo 'OK              ATH' >> /etc/chatscripts/gprs;
echo 'OK              ATE1' >> /etc/chatscripts/gprs;
echo ' ' >> /etc/chatscripts/gprs;
echo '# +CPIN provides the SIM card PIN' >> /etc/chatscripts/gprs;
echo '#OK             "AT+CPIN=1234"' >> /etc/chatscripts/gprs;
echo ' ' >> /etc/chatscripts/gprs;
echo '# +CFUN may allow to configure the handset to limit operations to' >> /etc/chatscripts/gprs;
echo '# GPRS/EDGE/UMTS/etc to save power, but the arguments are not standard' >> /etc/chatscripts/gprs;
echo '# except for 1 which means "full functionality".' >> /etc/chatscripts/gprs;
echo '#OK             AT+CFUN=1' >> /etc/chatscripts/gprs;
echo ' ' >> /etc/chatscripts/gprs;
echo 'OK              AT+CGDCONT=1,"IP","\T","",0,0' >> /etc/chatscripts/gprs;
echo 'OK              ATD*99#' >> /etc/chatscripts/gprs;
echo 'TIMEOUT         22' >> /etc/chatscripts/gprs;
echo 'CONNECT         ""' >> /etc/chatscripts/gprs);

# Export pins

echo "115" > /sys/class/gpio/export;
echo "out" > /sys/class/gpio/gpio115/direction;
echo "116" > /sys/class/gpio/export;
echo "out" > /sys/class/gpio/gpio116/direction;

# Init pins

echo "0" > /sys/devices/virtual/gpio/gpio115/value;
echo "0" > /sys/devices/virtual/gpio/gpio116/value;

# Power on

# Check if the modem is ON
stty -F /dev/ttyS2 9600;

(chat -t 5 -vs '' 'AT' 'OK' > /dev/ttyS2 < /dev/ttyS2) && echo 'modem already ON';

if [ $? -eq 3 ]
then
	echo "1" > /sys/devices/virtual/gpio/gpio116/value;
fi

# Reset 

echo "1" > /sys/devices/virtual/gpio/gpio115/value;

# Start PPP

pon fona;
