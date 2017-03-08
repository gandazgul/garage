/** Module dependencies ***********************/
var minimist = require('minimist');
var express = require('express');
var logger = require('morgan');
var http = require('http');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var path = require('path');
var execSync = require('child_process').execSync;

// args
var args = minimist(process.argv);
var isTest = !!args.test;

var app = express();

app.set('port', process.env.PORT || 4000);

// Auth setup
var auth = require('http-auth');
var basic = auth.basic({
        realm: "Web."
    }, function (username, password, callback) { // Custom authentication method.
        callback(username === "user" && password === "password");
    }
);
app.use(auth.connect(basic));

// Serve the FE
var publicDir;

if (process.env.NODE_ENV === 'production') {
    publicDir = path.join(__dirname, 'public');

    app.use(favicon(path.join(publicDir, 'favicon.ico')));
    app.use(express.static(publicDir));
}
else {
    publicDir = path.join(__dirname, '..', 'build', 'public');

    app.use(favicon(path.join(publicDir, 'favicon.ico')));
    app.use(express.static(publicDir));
}

app.use(logger('dev'));
app.use(bodyParser.json());

//routes
app.get('/api', function (req, res) {
    var MAGNET_GPIO = 3;
    var command = `gpioctl get ${MAGNET_GPIO}`;
    if (isTest) {
        command = `echo "${command}\nPin 3 is HIGH"`;
    }

    var response = {
        isOpened: false,
    };

    var result = execSync(command).toString();
    var lines = result.split('\n');

    if (lines && lines[1]) {
        if (lines[1] === `Pin ${MAGNET_GPIO} is HIGH`) {
            response.isOpened = false;
        }
        else if (lines[1] === `Pin ${MAGNET_GPIO} is LOW`) {
            response.isOpened = true;
        }
    }
    else {
        throw new Error(`Can't read gpio ${MAGNET_GPIO}`);
    }

    res.append('Access-Control-Allow-Origin', 'http://localhost,http://1.1.1.9').json(response);
});

app.post('/api', function (req, res) {
    var RELAY_ID = 0;
    var state = parseInt(req.body.state, 10);
    var command = `relay-exp ${RELAY_ID} 1 && relay-exp ${RELAY_ID} 0`;
    if (isTest) {
        command = `echo "> Setting RELAY0 to ON\n> Setting RELAY0 to OFF"`;
    }

    var result = execSync(command).toString();
    var lines = result.split('\n');

    res.append('Access-Control-Allow-Origin', 'http://localhost,http://1.1.1.9');

    if (lines && lines[0]) {
        if (
            (lines[0] === `> Setting RELAY${RELAY_ID} to ON`) &&
            (lines[1] === `> Setting RELAY${RELAY_ID} to OFF`)
        ) {
            res.status(200);
            res.send('OK');
        }
        else {
            res.status(500);
            res.send(`Unexpected output from command: ${command} => ${lines[0]}`);
        }
    }
    else {
        res.status(500);
        res.send(`Can't read output from command: ${command}`);
    }
});

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
