/** Module dependencies ************************************************/
var express = require('express');
var logger = require('morgan');
var http = require('http');
var https = require('https');
var execSync = require('child_process').execSync;

var isTest = process.env.NODE_ENV !== 'production';

if (isTest) {
    require('dotenv').config({path: `${__dirname}/../.env`});
}
else {
    require('dotenv').config({path: `${__dirname}/.env`});
}

var app = express();
app.set('port', process.env.PORT || 4000)
    .use(logger('dev'));

/** Helpers ************************************************/
// initialize relay chip
if (!isTest) {
    var result = execSync('relay-exp -i').toString();
    var lines = result.split('\n');
    if (!lines || (lines && lines[0] !== '> Initializing Relay Expansion chip')) {
        throw new Error('Unrecognized output when initializing relay chip.');
    }
}

/**
 * Checks the current state of the door
 *
 * @returns {boolean} true for opened, false for closed
 */
function checkDoorIsOpened() {
    var MAGNET_GPIO = 3;
    var command = `gpioctl get ${MAGNET_GPIO}`;
    if (isTest) {
        command = `echo "${command}\nPin 3 is ${Math.random() > 0.5 ? 'LOW' : 'HIGH'}"`;
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

/** Setup socket.io ************************************************/
var server = http.createServer(app);
var io = require('socket.io')(server, {serveClient: false});

function toggleDoor(socket) {
    console.log("trigger_door");

    // trigger the door
    var RELAY_ID = 1;
    var openCommand = `relay-exp ${RELAY_ID} 1`;
    var closeCommand = `relay-exp ${RELAY_ID} 0`;
    if (isTest) {
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

            }
            else {
                socket.emit('garage_error', {message: `Unexpected output from command: ${openCommand} && ${closeCommand} => ${openLines[0]} && ${closeLines[0]}`});
            }
        }
        else {
            socket.emit('garage_error', {message: `Can't read output from command: ${openCommand} && ${closeCommand}`});
        }
    }, 500);
}

function socketConnected(accessToken, socket) {
    var loginParams = socket.request._query;

    // new connection, check the accesstoken validity
    https.get(
        `https://graph.facebook.com/debug_token?input_token=${loginParams.token}&access_token=${accessToken}`,
        (res) => {
            res.setEncoding('utf8');
            var rawData = '';
            res.on('data', (chunk) => {
                rawData += chunk;
            });
            res.on('end', () => {
                try {
                    // Check if the user id is one of the ones allowed
                    var parsedData = JSON.parse(rawData).data;
                    var userIDs = process.env.FACEBOOK_USER_IDS.split(',');

                    if (
                        userIDs.indexOf(loginParams.userID) !== -1 &&
                        loginParams.appID === parsedData.app_id &&
                        loginParams.userID === parsedData.user_id &&
                        parsedData.is_valid === true
                    ) {
                        console.log('successful connection to socket.io');

                        //check every second what the door state is and send it
                        var lastState = null;
                        var timer = setInterval(function () {
                            var isOpened = checkDoorIsOpened();

                            if (lastState !== isOpened) {
                                lastState = isOpened;
                                socket.emit('door_state', {isOpened});
                            }
                        }, 1000);

                        socket.on('trigger_door', toggleDoor.bind(null, socket));
                    }
                    else {
                        var message = 'Failed connection to socket: User not allowed.';
                        console.log(message);
                        socket.emit('garage_error', {message});
                    }
                }
                catch (e) {
                    console.error(e.message);
                    socket.emit('garage_error', {message: e.message});
                }
            });
        }
    );
}

// get facebook access token
https.get(
    `https://graph.facebook.com/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&grant_type=client_credentials`,
    (res) => {
        res.setEncoding('utf8');
        var rawData = '';

        res.on('data', (chunk) => {
            rawData += chunk;
        });

        res.on('end', () => {
            try {
                var parsedData = JSON.parse(rawData);
                var accessToken = parsedData.access_token;

                io.on('connection', socketConnected.bind(null, accessToken));

            } catch (e) {
                console.error(e.message);
            }
        });
    }
);

/** Finally start listening ************************************************/
server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
