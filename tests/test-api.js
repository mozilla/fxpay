describe('fxpay.API()', function () {
  var api;
  var baseUrl = 'https://not-a-real-api';
  var versionPrefix = '/api/v1';

  beforeEach(function() {
    helper.setUp();
    fxpay.configure({apiVersionPrefix: versionPrefix});
    api = new fxpay.api.API(baseUrl);
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('should handle POSTs', function (done) {
    helper.server.respondWith(
      'POST', /.*\/post/,
      function(request) {
        assert.equal(request.requestHeaders.Accept, 'application/json');
        assert.equal(request.requestHeaders['Content-Type'],
                     'application/x-www-form-urlencoded;charset=utf-8');
        assert.equal(request.requestBody, 'foo=bar&baz=zop');
        request.respond(200, {"Content-Type": "application/json"},
                        '{"data": "received"}');
      });

    api.post('/post', {foo: 'bar', 'baz': 'zop'}, function(err, data) {
      assert.equal(data.data, 'received');
      done(err);
    });

    helper.server.respond();
  });

  it('should handle GETs', function (done) {
    helper.server.respondWith(
      'GET', /.*\/get/,
      function(request) {
        assert.equal(request.requestHeaders.Accept, 'application/json');
        assert.equal(request.requestHeaders['Content-Type'], undefined);
        request.respond(200, {"Content-Type": "application/json"},
                        '{"data": "received"}');
      });

    api.get('/get', function(err, data) {
      assert.equal(data.data, 'received');
      done(err);
    });

    helper.server.respond();
  });

  it('should handle PUTs', function (done) {
    helper.server.respondWith(
      'PUT', /.*\/put/,
      function(request) {
        assert.equal(request.requestHeaders.Accept, 'application/json');
        assert.equal(request.requestHeaders['Content-Type'],
                     'application/x-www-form-urlencoded;charset=utf-8');
        request.respond(200, {"Content-Type": "application/json"},
                        '{"data": "received"}');
      });

    api.put('/put', {foo: 'bar'}, function(err, data) {
      assert.equal(data.data, 'received');
      done(err);
    });

    helper.server.respond();
  });

  it('should handle DELETEs', function (done) {
    helper.server.respondWith(
      'DELETE', /.*\/delete/,
      [200, {"Content-Type": "application/json"},
       '{"data": "received"}']);

    api.del('/delete', function(err, data) {
      assert.equal(data.data, 'received');
      done(err);
    });

    helper.server.respond();
  });

  it('should send the library version with each request', function (done) {
    helper.server.respondWith(
      'GET', /.*/,
      function(request) {
        assert.ok(fxpay.settings.libVersion);  // make sure it's defined.
        assert.equal(request.requestHeaders['x-fxpay-version'],
                     fxpay.settings.libVersion);
        request.respond(200, {"Content-Type": "application/json"}, '{}');
      });

    api.get('/get', function(err) {
      done(err);
    });

    helper.server.respond();
  });

  it('should allow custom content-type POSTs', function (done) {
    helper.server.respondWith(
      'POST', /.*\/post/,
      function(request) {
        assert.equal(request.requestHeaders['Content-Type'],
                     'text/plain;charset=utf-8');
        assert.equal(request.requestBody, 'custom-data');
        request.respond(200, {"Content-Type": "application/json"},
                        '{"data": "received"}');
      });

    api.post('/post', 'custom-data', function(err) {
      done(err);
    }, {contentType: 'text/plain'});

    helper.server.respond();
  });

  it('should send custom headers', function (done) {
    helper.server.respondWith(
      'GET', /.*\/get/,
      function(request) {
        assert.equal(request.requestHeaders.Foobar, 'bazba');
        assert.equal(request.requestHeaders.Zoopa, 'wonza');
        request.respond(200, {"Content-Type": "application/json"},
                        '{"data": "received"}');
      });

    api.get('/get', function(err) {
      done(err);
    }, {headers: {Foobar: 'bazba', Zoopa: 'wonza'}});

    helper.server.respond();
  });

  it('should report XHR abort', function (done) {
    helper.server.respondWith(function(xhr) {
      // We use a custom event because xhr.abort() triggers load first
      // https://github.com/cjohansen/Sinon.JS/issues/432
      dispatchXhrEvent(xhr, 'abort');
    });

    api.post('/some/path', null, function(err) {
      assert.equal(err, 'API_REQUEST_ABORTED');
      done();
    });

    helper.server.respond();
  });

  it('should report XHR errors', function (done) {
    helper.server.respondWith(function(xhr) {
      dispatchXhrEvent(xhr, 'error');
    });

    api.post('/some/path', null, function(err) {
      assert.equal(err, 'API_REQUEST_ERROR');
      done();
    });

    helper.server.respond();
  });

  it('should report non-200 responses', function (done) {
    helper.server.respondWith(
      'POST', /.*\/some\/path/,
      [500, {"Content-Type": "application/json"},
       JSON.stringify({webpayJWT: '<jwt>',
                       contribStatusURL: '/somewhere'})]);

    api.post('/some/path', null, function(err) {
      assert.equal(err, 'BAD_API_RESPONSE');
      done();
    });

    helper.server.respond();
  });

  it('should report unparsable JSON', function (done) {
    helper.server.respondWith(
      'POST', /.*\/some\/path/,
      /* jshint -W044 */
      [200, {"Content-Type": "application/json"},
       "{this\is not; valid JSON'"]);
      /* jshint +W044 */

    api.post('/some/path', null, function(err) {
      assert.equal(err, 'BAD_JSON_RESPONSE');
      done();
    });

    helper.server.respond();
  });

  it('should parse and return JSON', function (done) {
    helper.server.respondWith(
      'POST', /.*\/some\/path/,
      [200, {"Content-Type": "application/json"},
       '{"is_json": true}']);

    api.post('/some/path', null, function(err, data) {
      assert.equal(data.is_json, true);
      done(err);
    });

    helper.server.respond();
  });

  it('should request a full URL based on a path', function (done) {
    helper.server.respondWith(
      'POST', new RegExp(baseUrl + versionPrefix + '/path/check'),
      [200, {"Content-Type": "application/json"},
       '{"foo":"bar"}']);

    api.post('/path/check', null, function(err) {
      // If this is not a 404 then we're good.
      done(err);
    });

    helper.server.respond();
  });

  it('should request an absolute https URL when specified', function (done) {
    var absUrl = 'https://secure-site.com/some/page';

    helper.server.respondWith('POST', absUrl,
                       [200, {"Content-Type": "application/json"},
                        '{"foo":"bar"}']);

    api.post(absUrl, null, function(err) {
      // If this is not a 404 then we're good.
      done(err);
    });

    helper.server.respond();
  });

  it('should request an absolute http URL when specified', function (done) {
    var absUrl = 'http://insecure-site.com/some/page';

    helper.server.respondWith('POST', absUrl,
                       [200, {"Content-Type": "application/json"},
                        '{"foo":"bar"}']);

    api.post(absUrl, null, function(err) {
      // If this is not a 404 then we're good.
      done(err);
    });

    helper.server.respond();
  });

  it('should timeout', function (done) {
    helper.server.respondWith(function(xhr) {
      // We simulate a timeout event here because Sinon
      // doesn't seem to support the XHR.timeout property.
      // https://github.com/cjohansen/Sinon.JS/issues/431
      dispatchXhrEvent(xhr, 'timeout');
    });

    api.post('/timeout', null, function(err) {
      assert.equal(err, 'API_REQUEST_TIMEOUT');
      done();
    });

    helper.server.respond();
  });

  it('should allow you to get unversioned URLs', function (done) {
    assert.equal(api.url('/not/versioned', {versioned: false}),
                 baseUrl + '/not/versioned');
    done();
  });

  it('should allow you to get versioned URLs', function (done) {
    assert.equal(api.url('/this/is/versioned'),
                 baseUrl + versionPrefix + '/this/is/versioned');
    done();
  });


  function dispatchXhrEvent(xhr, eventName, bubbles, cancelable) {
    xhr.dispatchEvent(new sinon.Event(eventName, bubbles, cancelable, xhr));
    // Prevent future listening, like, in future tests.
    // Maybe this is fixed now?
    // See https://github.com/cjohansen/Sinon.JS/issues/430
    xhr.eventListeners = {};
  }

});
