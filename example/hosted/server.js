var fs = require('fs');
var path = require('path');

var express = require('express');
var morgan = require('morgan');

var app = express();
var router = express.Router();
var projectDir = path.normalize(__dirname + '/../..');
var hostedDir = projectDir + '/example/hosted';
var media = projectDir + '/example/shared';
var fxPayRelPath = 'build/fxpay.min.js';

if (!fs.existsSync(projectDir + '/' + fxPayRelPath)) {
  throw new Error(fxPayRelPath + ' does not exist. ' +
                  'You need to run `grunt compress` first');
}

router.use(morgan('dev'))  // logging

router.get('/fxpay.min.js', function (req, res) {
  res.sendFile(fxPayRelPath, {root: projectDir});
});

router.get('/manifest.webapp', function (req, res) {
  res.sendFile('manifest.webapp', {root: hostedDir});
});

console.log('Serving media from:', media);
router.use('/', express.static(media));

app.use('/', router);

var port = process.env['PORT'] || 3000;
app.listen(port);
console.log('Listening on port ' + port);
