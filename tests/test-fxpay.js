describe('fxpay', function () {
  var server;

  beforeEach(function() {
    console.log('beginEach');
    server = sinon.fakeServer.create();
    fxpay.configure({
      apiUrlBase: 'http://tests-should-never-hit-this.com',
      callbacks: {},
      initError: null,
      mozApps: mozAppsStub
    });
  });

  afterEach(function() {
    server.restore();
  });

  describe('init()', function() {

    beforeEach(function() {
      appSelf.init();
    });

    it('should call back when started', function (done) {
      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {
          done();
        }
      });

      appSelf.onsuccess();
    });

    it('should error when addReceipt does not exist', function (done) {
      var appStub = {
        addReceipt: undefined,  // older FxOSs do not have this.
        onsuccess: function() {},
        onerror: function() {}
      };
      appStub.result = appStub;  // result of DOM request.

      fxpay.configure({
        mozApps: {
          getSelf: function() {
            return appStub;
          }
        }
      });

      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
          done();
        }
      });

      appStub.onsuccess();
    });

    it('should error when not running as app', function (done) {
      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'NOT_INSTALLED_AS_APP');
          done();
        }
      });

      // This happens when you access the app from a browser
      // (i.e. not installed).
      appSelf.result = null;
      appSelf.onsuccess();
    });

    it('should pass through apps platform errors', function (done) {
      fxpay.init({
        onerror: function(err) {
          console.log('GOT error', err);
          assert.equal(err, 'INVALID_MANIFEST');
          done();
        }
      });

      // Simulate an apps platform error.
      appSelf.error = {name: 'INVALID_MANIFEST'};
      appSelf.onerror();
    });

    it('should error when apps are not supported', function (done) {
      fxpay.configure({
        mozApps: {}  // invalid mozApps.
      });
      fxpay.init({
        onerror: function(err) {
          console.log('GOT error', err);
          assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
          done();
        }
      });
    });

    it('should error when no apps API at all', function (done) {
      fxpay.configure({
        mozApps: null  // no API, like Chrome or whatever.
      });
      fxpay.init({
        onerror: function(err) {
          console.log('GOT error', err);
          assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
          done();
        }
      });
    });

  });

  describe('purchase()', function () {
    var mozPay;

    beforeEach(function() {
      mozPay = sinon.spy(mozPayStub);
      appSelf.init();
      fxpay.configure({
        appSelf: appSelf,
        mozPay: mozPay
      });
    });

    afterEach(function() {
      mozPay.reset();
      receiptAdd.reset();
    });

    it('should pass through setup errors', function (done) {
      // Trigger a setup error:
      fxpay.configure({
        mozApps: {},  // invalid mozApps.
      });
      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
          done();
        }
      });

      // Try to start a purchase.
      fxpay.purchase('123');
    });

    it('should send a JWT to mozPay', function (done) {
      var webpayJWT = '<base64 JWT>';
      var productId = '1234';
      var cfg = {
        apiUrlBase: 'https://not-the-real-marketplace',
        apiVersionPrefix: '/api/v1'
      };
      fxpay.configure(cfg);

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        onpurchase: function(info) {
          assert.ok(mozPay.called);
          assert.ok(mozPay.calledWith([webpayJWT]), mozPay.firstCall);
          assert.equal(info.productId, productId);
          assert.equal(info.newPurchase, true);
          done();
        },
      });

      fxpay.purchase(productId);

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        cfg.apiUrlBase + cfg.apiVersionPrefix + '/webpay/inapp/prepare/',
        // TODO: assert somehow that productId is part of post data.
        productData({webpayJWT: webpayJWT}));
      server.respond();

      mozPay.returnValues[0].onsuccess();

      server.respondWith(
        'GET',
        cfg.apiUrlBase + '/transaction/XYZ',
        transactionData());
      server.respond();

      receiptAdd.onsuccess();
    });

    it('should timeout polling the transaction', function (done) {

      fxpay.init({
        onerror: function(err) {
          console.log('GOT error', err);
          assert.equal(err, 'TRANSACTION_TIMEOUT');
          done();
        },
      });

      fxpay.purchase('123', {
        maxTries: 2,
        pollIntervalMs: 1
      });

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /http.*\/webpay\/inapp\/prepare/,
        productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      server.autoRespond = true;
      server.respondWith(
        'GET',
        /http.*\/transaction\/XYZ/,
        transactionData({status: 'incomplete'}));
      server.respond();
    });

    it('should call back with mozPay error', function (done) {

      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'DIALOG_CLOSED_BY_USER');
          done();
        }
      });

      fxpay.purchase('123');

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /.*webpay\/inapp\/prepare/,
        productData());
      server.respond();

      var domReq = mozPay.returnValues[0];
      domReq.error = {name: 'DIALOG_CLOSED_BY_USER'};
      domReq.onerror();
    });

    it('should report invalid transaction state', function (done) {

      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'INVALID_TRANSACTION_STATE');
          done();
        }
      });

      fxpay.purchase('123');

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /http.*\/webpay\/inapp\/prepare/,
        productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      // Respond to polling the transaction.
      server.respondWith(
        'GET',
        /http.*\/transaction\/XYZ/,
        transactionData({status: 'THIS_IS_NOT_A_VALID_STATE'}));
      server.respond();

      receiptAdd.onsuccess();
    });

    it('should error when mozPay is not supported', function (done) {
      fxpay.configure({mozPay: undefined});

      fxpay.init({
        onerror: function(err) {
          console.log('GOT error', err);
          assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
          done();
        }
      });

      fxpay.purchase('123');
    });

    it('should add a Marketplace receipt to device', function (done) {
      var receipt = '<receipt>';

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        onpurchase: function() {
          assert.equal(receiptAdd._receipt, receipt);
          done();
        }
      });

      fxpay.purchase('123');

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /.*\/webpay\/inapp\/prepare/,
        productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      server.respondWith(
        'GET',
        /.*\/transaction\/XYZ/,
        transactionData({receipt: receipt}));
      server.respond();

      receiptAdd.onsuccess();
    });

    it('should pass through receipt errors', function (done) {

      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'ADD_RECEIPT_ERROR');
          done();
        }
      });

      fxpay.purchase('123');

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /.*\/webpay\/inapp\/prepare/,
        productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      server.respondWith(
        'GET',
        /.*\/transaction\/XYZ/,
        transactionData());
      server.respond();

      // Simulate a receipt installation error.
      receiptAdd.error = {name: 'ADD_RECEIPT_ERROR'};
      receiptAdd.onerror();
    });
  });


  describe('API', function () {
    var api;
    var baseUrl = 'https://not-a-real-api';
    var versionPrefix = '/api/v1';

    beforeEach(function() {
      fxpay.configure({apiVersionPrefix: versionPrefix});
      api = new fxpay.API(baseUrl);
    });

    it('should handle POSTs', function (done) {
      server.respondWith(
        'POST', /.*\/post/,
        function(request) {
          assert.equal(request.requestHeaders['Accept'], 'application/json');
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

      server.respond();
    });

    it('should handle GETs', function (done) {
      server.respondWith(
        'GET', /.*\/get/,
        function(request) {
          assert.equal(request.requestHeaders['Accept'], 'application/json');
          assert.equal(request.requestHeaders['Content-Type'], undefined);
          request.respond(200, {"Content-Type": "application/json"},
                          '{"data": "received"}');
        });

      api.get('/get', function(err, data) {
        assert.equal(data.data, 'received');
        done(err);
      });

      server.respond();
    });

    it('should handle PUTs', function (done) {
      server.respondWith(
        'PUT', /.*\/put/,
        function(request) {
          assert.equal(request.requestHeaders['Accept'], 'application/json');
          assert.equal(request.requestHeaders['Content-Type'],
                       'application/x-www-form-urlencoded;charset=utf-8');
          request.respond(200, {"Content-Type": "application/json"},
                          '{"data": "received"}');
        });

      api.put('/put', {foo: 'bar'}, function(err, data) {
        assert.equal(data.data, 'received');
        done(err);
      });

      server.respond();
    });

    it('should handle DELETEs', function (done) {
      server.respondWith(
        'DELETE', /.*\/delete/,
        [200, {"Content-Type": "application/json"},
         '{"data": "received"}']);

      api.del('/delete', function(err, data) {
        assert.equal(data.data, 'received');
        done(err);
      });

      server.respond();
    });

    it('should allow custom content-type POSTs', function (done) {
      server.respondWith(
        'POST', /.*\/post/,
        function(request) {
          assert.equal(request.requestHeaders['Content-Type'],
                       'text/plain;charset=utf-8');
          assert.equal(request.requestBody, 'custom-data');
          request.respond(200, {"Content-Type": "application/json"},
                          '{"data": "received"}');
        });

      api.post('/post', 'custom-data', function(err, data) {
        done(err);
      }, {contentType: 'text/plain'});

      server.respond();
    });

    it('should send custom headers', function (done) {
      server.respondWith(
        'GET', /.*\/get/,
        function(request) {
          assert.equal(request.requestHeaders['Foobar'], 'bazba');
          assert.equal(request.requestHeaders['Zoopa'], 'wonza');
          request.respond(200, {"Content-Type": "application/json"},
                          '{"data": "received"}');
        });

      api.get('/get', function(err, data) {
        done(err);
      }, {headers: {Foobar: 'bazba', Zoopa: 'wonza'}});

      server.respond();
    });

    it('should report XHR abort', function (done) {
      server.respondWith(function(xhr, id) {
        // We use a custom event because xhr.abort() triggers load first
        // https://github.com/cjohansen/Sinon.JS/issues/432
        dispatchXhrEvent(xhr, 'abort');
      });

      api.post('/some/path', null, function(err) {
        assert.equal(err, 'API_REQUEST_ABORTED');
        done();
      });

      server.respond();
    });

    it('should report XHR errors', function (done) {
      server.respondWith(function(xhr, id) {
        dispatchXhrEvent(xhr, 'error');
      });

      api.post('/some/path', null, function(err) {
        assert.equal(err, 'API_REQUEST_ERROR');
        done();
      });

      server.respond();
    });

    it('should report non-200 responses', function (done) {
      server.respondWith(
        'POST', /.*\/some\/path/,
        [500, {"Content-Type": "application/json"},
         JSON.stringify({webpayJWT: '<jwt>',
                         contribStatusURL: '/somewhere'})]);

      api.post('/some/path', null, function(err) {
        assert.equal(err, 'BAD_API_RESPONSE');
        done();
      });

      server.respond();
    });

    it('should report unparsable JSON', function (done) {
      server.respondWith(
        'POST', /.*\/some\/path/,
        [200, {"Content-Type": "application/json"},
         "{this\is not; valid JSON'"]);

      api.post('/some/path', null, function(err) {
        assert.equal(err, 'BAD_JSON_RESPONSE');
        done();
      });

      server.respond();
    });

    it('should parse and return JSON', function (done) {
      server.respondWith(
        'POST', /.*\/some\/path/,
        [200, {"Content-Type": "application/json"},
         '{"is_json": true}']);

      api.post('/some/path', null, function(err, data) {
        assert.equal(data.is_json, true);
        done(err);
      });

      server.respond();
    });

    it('should request a full URL based on a path', function (done) {
      server.respondWith(
        'POST', new RegExp(baseUrl + versionPrefix + '/path/check'),
        [200, {"Content-Type": "application/json"},
         '{"foo":"bar"}']);

      api.post('/path/check', null, function(err) {
        // If this is not a 404 then we're good.
        done(err);
      });

      server.respond();
    });

    it('should request an absolute https URL when specified', function (done) {
      var absUrl = 'https://secure-site.com/some/page';

      server.respondWith('POST', absUrl,
                         [200, {"Content-Type": "application/json"},
                          '{"foo":"bar"}']);

      api.post(absUrl, null, function(err) {
        // If this is not a 404 then we're good.
        done(err);
      });

      server.respond();
    });

    it('should request an absolute http URL when specified', function (done) {
      var absUrl = 'http://insecure-site.com/some/page';

      server.respondWith('POST', absUrl,
                         [200, {"Content-Type": "application/json"},
                          '{"foo":"bar"}']);

      api.post(absUrl, null, function(err) {
        // If this is not a 404 then we're good.
        done(err);
      });

      server.respond();
    });

    it('should timeout', function (done) {
      server.respondWith(function(xhr, id) {
        // We simulate a timeout event here because Sinon
        // doesn't seem to support the XHR.timeout property.
        // https://github.com/cjohansen/Sinon.JS/issues/431
        dispatchXhrEvent(xhr, 'timeout');
      });

      api.post('/timeout', null, function(err) {
        assert.equal(err, 'API_REQUEST_TIMEOUT');
        done();
      });

      server.respond();
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
  });
});


function dispatchXhrEvent(xhr, eventName, bubbles, cancelable) {
  xhr.dispatchEvent(new sinon.Event(eventName, bubbles, cancelable, xhr));
  // Prevent future listening, like, in future tests.
  // Make this is fixed now?
  // See https://github.com/cjohansen/Sinon.JS/issues/430
  xhr.eventListeners = {};
}


function productData(overrides, status) {
  // Create a JSON server response to a request for product data.
  overrides = overrides || {};
  var data = {
    webpayJWT: '<jwt>',
    contribStatusURL: '/transaction/XYZ',
  };
  for (var k in data) {
    if (overrides[k]) {
      data[k] = overrides[k];
    }
  }
  return [status || 200, {"Content-Type": "application/json"},
          JSON.stringify(data)];
}


function transactionData(overrides, status) {
  // Create a JSON server response to a request for transaction data.
  overrides = overrides || {};
  var data = {
    status: 'complete',
    // Pretend this is a real Marketplace receipt.
    receipt: '<keys>~<receipt>'
  };
  for (var k in data) {
    if (overrides[k]) {
      data[k] = overrides[k];
    }
  }
  return [status || 200, {"Content-Type": "application/json"},
          JSON.stringify(data)];
}


function mozPayStub() {
  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
  return {
    onsuccess: function() {},
    onerror: function() {}
  };
}


var receiptAdd = {
  error: null,
  _receipt: null,
  onsuccess: function() {},
  onerror: function() {},
  reset: function() {
    this._receipt = null;
    this.error = null;
  }
};


var appSelf = {
  error: null,
  addReceipt: function(receipt) {
    receiptAdd._receipt = receipt;
    return receiptAdd;
  },
  onsuccess: function() {},
  onerror: function() {},
  init: function() {
    this.error = null;
    // This is the result of getSelf(). Setting it to this makes stubbing easier.
    this.result = this;
  }
};


// https://developer.mozilla.org/en-US/docs/Web/API/Apps.getSelf
var mozAppsStub = {
  getSelf: function() {
    return appSelf;
  }
};
