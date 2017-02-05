/** Module dependencies ***********************/
const minimist = require('minimist');
const express = require('express');
const http = require('http');
const favicon = require('serve-favicon');
const bodyParser = require('body-parser');
const path = require('path');

// args
const args = minimist(process.argv);
const isTest = !!args.test;

const app = express();

// all environments
app.set('port', process.env.PORT || 4000);

// app.engine('ejs', require('ejs-locals'));
// app.set('views', __dirname + '/views');
// app.set('view engine', 'ejs');

const publicDir = path.join(__dirname, '..', 'build');

app.use(favicon(path.join(publicDir, 'favicon.ico')));
// app.use(logger('dev'));
app.use(bodyParser());
app.use(express.static(publicDir));

//routes
app.get('/api', function (req, res) {
    const execSync = require('child_process').execSync;
    const MAGNET_GPIO = 3;
    let command = `gpioctl get ${MAGNET_GPIO}`;
    if (isTest) {
        command = `echo "${command}\nPin 3 is HIGH"`;
    }

    let response = {
        isOpened: false,
    };

    const result = execSync(command).toString();
    const lines = result.split('\n');

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
