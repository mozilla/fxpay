var fs = require('fs');
var path = require('path');

var express = require('express');
var morgan = require('morgan');

var app = express();
var router = express.Router();
var projectDir = path.normalize(__dirname + '/../..');
var hostedDir = projectDir + '/example/hosted';
var media = projectDir + '/example/shared';
var fxPayRelPath = 'build/lib/fxpay.debug.js';

if (!fs.existsSync(projectDir + '/' + fxPayRelPath)) {
  throw new Error(fxPayRelPath + ' does not exist. ' +
                  'You need to run `grunt compress` first');
}

router.use(morgan('dev'));  // logging

router.get('/fxpay.debug.js:suffix?', function (req, res) {
  res.sendFile(fxPayRelPath + (req.params.suffix || ''),
               {root: projectDir});
});

router.get('/lib/fxpay/:sourceFile', function (req, res) {
  // Load uncompressed files when debugging with a source map.
  res.sendFile('lib/fxpay/' + req.params.sourceFile,
               {root: projectDir});
});

router.get('/manifest.webapp', function (req, res) {
  res.sendFile('manifest.webapp', {root: hostedDir});
});

console.log('Serving media from:', media);
router.use('/', express.static(media));

app.use('/', router);

var port = process.env.PORT || 3000;
app.listen(port);
console.log('Listening on port ' + port);
