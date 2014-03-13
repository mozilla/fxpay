var express = require('express');
var app = express();
var media = __dirname;
// This is the name of the github project (in the URL).
var ghRoot = 'fxpay';

app.configure(function() {
  app.use(express.logger({format: 'dev'}));
  app.use(express.methodOverride());
});

app.get('/', function (req, res) {
  // Run everything from the github project subdirectory just
  // like on github pages.
  res.redirect('/' + ghRoot + '/');
});

app.get('/' + ghRoot + '/fxpay.js', function (req, res) {
  // This is a special case just for development.
  // It links to the source of the fxpay lib.
  var root = __dirname + '/../lib';
  res.sendfile('fxpay.js', {root: root,
                            // 1 millesecond for cache busting.
                            maxAge: 1});
});

app.configure(function() {
  // Serve static assets just like github pages.
  app.use('/' + ghRoot, express.static(media));
});

var port = process.env['PORT'] || 3000;
app.listen(port);
console.log('Serving static app at ' +
            'http://localhost:' + port + '/' + ghRoot + '/');
