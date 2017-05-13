/** Module dependencies ************************************************/
var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var http = require('http');
var https = require('https');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');
var execSync = require('child_process').execSync;
var passport = require('passport');
var Strategy = require('passport-facebook').Strategy;
var session = require('express-session');
var sessionStore = new session.MemoryStore();

var isTest = process.env.NODE_ENV !== 'production';

if (isTest) {
    require('dotenv').config({path: `${__dirname}/../.env`});
}
else {
    require('dotenv').config({path: `${__dirname}/.env`});
}

/** Express Setup ************************************************/
var sessionMiddleware = session({
    secret: process.env.COOKIE_SECRET,
    resave: true,
    saveUninitialized: true,
    store: sessionStore,
});
var app = express();
app.set('port', process.env.PORT || 4000)
    .use(logger('dev'))
    .use(cookieParser())
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({extended: true}))
    .use(sessionMiddleware);

/** Auth setup ************************************************/
passport.use(new Strategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK,
    },
    function (accessToken, refreshToken, profile, cb) {
        return cb(null, profile);
    }
));
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

    res.redirect('/login');
}

app.get('/login', function (req, res, next) {
    if (!req.user) { // Not already logged in, probably okay to try to hit the oauth provider
        return next();
    }

    res.redirect('/'); // Already logged in, send them where I want them after the callback anyway.
}, passport.authenticate('facebook', {scope: 'public_profile'}));

app.get('/login/error', function (req, res) {
    console.log('error');
    res.send('login error');
});

app.get('/login/facebook/callback', function (req, res, next) {
    var success = function () {
        res.redirect('/');
    };

    var failure = function (error) {
        console.log(error);
        res.send(500, error);
    };

    // call authenticate manually with a custom callbackto check that the users are allowed
    (passport.authenticate('facebook', function (err, user) {
        if (err) {
            failure(err);
        }
        else if (!user) {
            failure("Invalid login data");
        }
        else {
            var userIDs = process.env.FACEBOOK_USER_IDS.split(',');

            if (userIDs.indexOf(user.id) === -1) {
                failure("User not allowed");
            }
            else {
                // req.login is added by the passport.initialize()
                // middleware to manage login state. We need
                // to call it directly, as we're overriding
                // the default passport behavior.
                req.login(user, function (err) {
                    if (err) {
                        failure(err);
                    }
                    success();
                });
            }
        }
    }))(req, res, next);
});

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

/** Serve the FE ************************************************/
var publicDir;

if (process.env.NODE_ENV === 'production') {
    publicDir = path.join(__dirname, 'public');
}
else {
    publicDir = path.join(__dirname, '..', 'build', 'public');
}

app.use(favicon(path.join(publicDir, 'static', 'favicon.ico')));
app.use('/static', ensureAuthenticated);
app.use('/static', express.static(path.join(publicDir, 'static')));

app.get([
    '/manifest.json',
    '/google4abbc01915c5e65d.html'
], function (req, res) {
    var filePath = path.join(publicDir, req.path);

    if (fs.statSync(filePath)) {
        res.sendFile(filePath);
    }
    else {
        res.status(404).send();
    }
});

app.get('/:file?', ensureAuthenticated, function (req, res) {
    var filePath = path.join(publicDir, req.params.file || 'index.html');

    if (fs.statSync(filePath)) {
        res.sendFile(filePath);
    }
    else {
        res.status(404).send();
    }
});

/** Setup socket.io ************************************************/
var server = http.createServer(app);
var io = require('socket.io')(server, {serveClient: false});
// var passportSocketIo = require("passport.socketio");

// io.use(passportSocketIo.authorize({
//     cookieParser: cookieParser,       // the same middleware you registrer in express
//     key:          'connect.sid',       // the name of the cookie where express/connect stores its session_id
//     secret:       process.env.COOKIE_SECRET,    // the session_secret to parse the cookie
//     store:        sessionStore,        // we NEED to use a sessionstore. no memorystore please
//     success:      onAuthorizeSuccess,  // *optional* callback on success - read more below
//     fail:         onAuthorizeFail,     // *optional* callback on fail/error - read more below
// }))


https.get(
    `https://graph.facebook.com/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&grant_type=client_credentials`,
    (res) => {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => {
            rawData += chunk;
        });
        res.on('end', () => {
            try {
                const parsedData = JSON.parse(rawData);
                const accessToken = parsedData.access_token;

                io.on('connection', function (socket) {
                    const loginParams = socket.request._query;

                    https.get(
                        `https://graph.facebook.com/debug_token?input_token=${loginParams.token}&access_token=${accessToken}`,
                        (res) => {
                            res.setEncoding('utf8');
                            let rawData = '';
                            res.on('data', (chunk) => {
                                rawData += chunk;
                            });
                            res.on('end', () => {
                                try {
                                    console.log(rawData);
                                    const parsedData = JSON.parse(rawData).data;
                                    const userIDs = process.env.FACEBOOK_USER_IDS.split(',');

                                    if (
                                        userIDs.indexOf(loginParams.userID) !== -1 &&
                                        loginParams.appID === parsedData.app_id &&
                                        loginParams.userID === parsedData.user_id &&
                                        parsedData.is_valid === true
                                    ) {
                                        console.log('successful connection to socket.io');

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
                                        });
                                    }
                                    else {
                                        console.log('failed connection to socket.io: User not allowed');
                                    }
                                }
                                catch (e) {
                                    console.error(e.message);
                                }
                            });
                        }
                    );
                });

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
