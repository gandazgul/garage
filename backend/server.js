/** Module dependencies ***********************/
var minimist = require('minimist');
var express = require('express');
var logger = require('morgan');
var http = require('http');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var path = require('path');
var execSync = require('child_process').execSync;
var passport = require('passport');
var Strategy = require('passport-google-oauth2').Strategy;
var session = require('express-session');

// args
var args = minimist(process.argv);
var isTest = !!args.test;

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

app.get('/', require('connect-ensure-login').ensureLoggedIn());

app.get('/login', passport.authenticate('google', {scope: ['profile']}));

app.get('/login/google/return',
    passport.authenticate('google', {failureRedirect: '/login'}),
    function (req, res) {
        res.redirect('/');
    });

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
