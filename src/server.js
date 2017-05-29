/** Module dependencies ************************************************/
var execSync = require('child_process').execSync;

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config({path: `${__dirname}/../.env`});
}
else {
    require('dotenv').config({path: `${__dirname}/.env`});
}

/** Helpers ************************************************/
// initialize relay chip
var isDoorOpened;

if (process.env.NODE_ENV === 'production') {
    try {
        var result = execSync('relay-exp -i').toString();
        var lines = result.split('\n');
        if (!lines || (lines && lines[0] !== '> Initializing Relay Expansion chip')) {
            throw new Error('Unrecognized output when initializing relay chip.');
        }
    }
    catch (e) {
        console.error('Couldn\'t initialize relay chip.');
    }
}
else {
    isDoorOpened = true;
}

/**
 * Checks the current state of the door
 *
 * @returns {boolean} true for opened, false for closed
 */
function checkDoorIsOpened() {
    var MAGNET_GPIO = 3;
    var command = `gpioctl get ${MAGNET_GPIO}`;
    if (process.env.NODE_ENV !== 'production') {
        command = `echo "${command}\nPin 3 is ${isDoorOpened ? 'LOW' : 'HIGH'}"`;
    }

    var result = execSync(command).toString();
    var lines = result.split('\n');

    if (lines && lines[1]) {
        if (lines[1] === `Pin ${MAGNET_GPIO} is LOW`) {
            return true;
        }
        else if (lines[1] === `Pin ${MAGNET_GPIO} is HIGH`) {
            return false;
        }
    }
    else {
        throw new Error(`Can't read gpio ${MAGNET_GPIO}`);
    }
}

function toggleDoor(errorHandler) {
    // trigger the door
    var RELAY_ID = 1;
    var openCommand = `relay-exp ${RELAY_ID} 1`;
    var closeCommand = `relay-exp ${RELAY_ID} 0`;
    if (process.env.NODE_ENV !== 'production') {
        openCommand = `echo "> Setting RELAY1 to ON"`;
        closeCommand = `echo "> Setting RELAY1 to OFF"`;
    }

    var openResult = execSync(openCommand).toString();
    setTimeout(() => {
        var closeResult = execSync(closeCommand).toString();
        var openLines = openResult.split('\n');
        var closeLines = closeResult.split('\n');

        if (openLines && openLines[0] && closeLines && closeLines[0]) {
            if (
                (openLines[0] === `> Setting RELAY${RELAY_ID} to ON`) &&
                (closeLines[0] === `> Setting RELAY${RELAY_ID} to OFF`)
            ) {
                if (process.env.NODE_ENV !== 'production') {
                    isDoorOpened = !isDoorOpened;
                }
            }
            else {
                errorHandler({message: `Unexpected output from command: ${openCommand} && ${closeCommand} => ${openLines[0]} && ${closeLines[0]}`});
            }
        }
        else {
            errorHandler({message: `Can't read output from command: ${openCommand} && ${closeCommand}`});
        }
    }, 500);
}

/** Setup MQTT ************************************************/
var mqtt = require('mqtt');
var ignoreNextMessage = true;
var lastState = null;

var client = mqtt.connect(`tls://${process.env.MQTT_SERVER}:${process.env.MQTT_PORT}`, {
    clientId: 'garage_node',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    rejectUnauthorized: false,
});

client.on('connect', function () {
    console.log('connected');

    client.subscribe('smartthings/Garage Door/door/state');
    client.publish('presence/hello', 'garage_node');
});

function connectionClosed() {
    console.log('\ndisconnected');

    client.publish('presence/bye', 'garage_node');

    setTimeout(function () {
        client.end();
        process.exit(0);
    }, 0);
}

client.on('close', connectionClosed);
process.on('SIGINT', connectionClosed);

function errorHandler(err) {
    client.publish('error', JSON.stringify(err));
    console.error('Error: ', err);
}

client.on('error', errorHandler);

client.on('message', function (topic, message) {
    if (ignoreNextMessage) {
        ignoreNextMessage = false;
    }
    else {
        console.log('Toggling door:', topic, message.toString());
        toggleDoor(errorHandler);
    }
});

//check every second what the door state is and send it
setInterval(function () {
    var isOpened = checkDoorIsOpened();

    if (lastState !== isOpened) {
        lastState = isOpened;

        var stateStr = isOpened ? 'open' : 'close';
        console.log('Sending state: ' + stateStr);
        client.publish('smartthings/Garage Door/door/set_state', stateStr);
    }
}, 1000);
