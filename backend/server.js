/** Module dependencies ***********************/
var express = require('express');
var logger = require('morgan');
var http = require('http');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');
var execSync = require('child_process').execSync;
var passport = require('passport');
var Strategy = require('passport-google-oauth2').Strategy;
var session = require('express-session');

var isTest = process.env.NODE_ENV !== 'production';

var app = express();
app.set('port', process.env.PORT || 4000);
app.use(logger('dev'));
app.use(require('cookie-parser')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(session({
    secret: 'GIpDh07f7Kf8V42OHlfRisoTFicmfji9rX14Q2QroUx0wUpxCn9MBKH9P2bVfOOHs72mAGEOiSolJAGJZoZGqYatVX2LMr1KmHdI',
    resave: true,
    saveUninitialized: true,
}));

// Auth setup
passport.use(new Strategy({
        // https://console.developers.google.com/apis/credentials?project=garage-opener-dev
        clientID: '838426561327-chlsmhjl34vtohulnri1ut73o6gf7iac.apps.googleusercontent.com',//process.env.CLIENT_ID,
        clientSecret: 'rk3t-9jmfE9hX9xFwXSxrLtp', //process.env.CLIENT_SECRET,
        callbackURL: 'http://localhost:4000/login/google/return'
    },
    function (accessToken, refreshToken, profile, cb) {
        // In this example, the user's Facebook profile is supplied as the user
        // record.  In a production-quality application, the Facebook profile should
        // be associated with a user record in the application's database, which
        // allows for account linking and authentication with other identity
        // providers.
        return cb(null, profile);
    })
);
passport.serializeUser(function (user, cb) {
    cb(null, user);
});
passport.deserializeUser(function (obj, cb) {
    cb(null, obj);
});
app.use(passport.initialize());
app.use(passport.session());

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    console.log('ensure');
    res.redirect('/login');
}

// Serve the FE
var publicDir;

if (process.env.NODE_ENV === 'production') {
    publicDir = path.join(__dirname, 'public');
}
else {
    publicDir = path.join(__dirname, '..', 'build', 'public');
}

app.use(favicon(path.join(publicDir, 'favicon.ico')));
app.use('/static', ensureAuthenticated);
app.use('/static', express.static(path.join(publicDir, 'static')));

// helpers
// initialize relay chip
if (!isTest) {
    var result = execSync('relay-exp -i').toString();
    var lines = result.split('\n');
    if (!lines || (lines && lines[0] !== '> Initializing Relay Expansion chip')) {
        throw new Error('Unrecognized output when initializing relay chip.');
    }
}

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

// setup socket.io
var server = http.createServer(app);
var io = require('socket.io').listen(server);
io.sockets.on('connection', function (socket) {
    //check every second what the door state is
    var lastState = null;
    var timer = setInterval(function () {
        var isOpened = checkDoorIsOpened();

        if (lastState !== isOpened) {
            lastState = isOpened;
            socket.emit('door_state', {isOpened});
        }
    }, 1000);

    socket.on('trigger_door', function (data) {
        console.log("trigger_door");

        // trigger the door
        var RELAY_ID = 0;
        var openCommand = `relay-exp ${RELAY_ID} 1`;
        var closeCommand = `relay-exp ${RELAY_ID} 0`;
        if (isTest) {
            openCommand = `echo "> Setting RELAY0 to ON"`;
            closeCommand = `echo "> Setting RELAY0 to OFF"`;
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
    });
});


// routes
app.get('/login', passport.authenticate('google', {scope: ['profile']}));

app.get('/login/error', function (req, res) {
    console.log('error');
    res.send('login error');
});

app.get('/login/google/return',
    passport.authenticate('google', {failureRedirect: '/login/error'}),
    function (req, res) {
        res.redirect('/');
    }
);

app.get('/:file?', ensureAuthenticated, function (req, res) {
    var filePath = path.join(publicDir, req.params.file || 'index.html');

    if (fs.statSync(filePath)) {
        res.sendFile(filePath);
    }
    else {
        res.status(404).send();
    }
});

server.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
