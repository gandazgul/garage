/** Module dependencies ***********************/
var minimist = require('minimist');
var express = require('express');
var http = require('http');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');
var path = require('path');

// args
var args = minimist(process.argv);
var isTest = !!args.test;

var app = express();

// all environments
app.set('port', process.env.PORT || 4000);

// app.engine('ejs', require('ejs-locals'));
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');

var publicDir = path.join(__dirname, '..', 'build');

app.use(favicon(path.join(publicDir, 'favicon.ico')));
// app.use(logger('dev'));
app.use(bodyParser());
app.use(express.static(publicDir));

//routes
app.get('/api', function (req, res) {
    var execSync = require('child_process').execSync;
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

    res.append('Access-Control-Allow-Origin', 'http://localhost:3000').json(response);
});

http.createServer(app).listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});
