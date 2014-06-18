describe('fxpay', function () {
  var server;

  beforeEach(function() {
    console.log('beginEach');
    server = sinon.fakeServer.create();
    fxpay.configure({
      appId: '55',  // some random value.
      apiUrlBase: 'http://tests-should-never-hit-this.com',
      initError: null,
      mozApps: mozAppsStub
    }, {
      reset: true
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

    it('should error with unknown options', function (done) {
      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'INCORRECT_USAGE');
          done();
        },
        oninit: function() {
          done('init should not have been called');
        },
        notAvalidOption: false
      });
    });

    it('should error when appId is empty', function (done) {
      fxpay.configure({
        appId: null
      });
      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'INCORRECT_USAGE');
          done();
        },
        oninit: function() {
          done('init should not have been called');
        }
      });
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
          console.log('ignoring err', err);
        }
      });

      // Try to start a purchase.
      fxpay.purchase('123', function(err) {
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        done();
      });
    });

    it('should send a JWT to mozPay', function (done) {
      var webpayJWT = '<base64 JWT>';
      var productId = '1234';
      var cfg = {
        apiUrlBase: 'https://not-the-real-marketplace',
        apiVersionPrefix: '/api/v1'
      };
      fxpay.configure(cfg);

      fxpay.purchase(productId, function(err, info) {
        assert.ok(mozPay.called);
        assert.ok(mozPay.calledWith([webpayJWT]), mozPay.firstCall);
        assert.equal(info.productId, productId);
        assert.equal(info.newPurchase, true);
        done(err);
      });

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

      fxpay.purchase('123', function(err) {
        assert.equal(err, 'TRANSACTION_TIMEOUT');
        done();
      }, {
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

      fxpay.purchase('123', function(err) {
        assert.equal(err, 'DIALOG_CLOSED_BY_USER');
        done();
      });

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

      fxpay.purchase('123', function(err) {
        assert.equal(err, 'INVALID_TRANSACTION_STATE');
        done();
      });

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

      fxpay.purchase('123', function(err) {
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        done();
      });
    });

    it('should add a Marketplace receipt to device', function (done) {
      var receipt = '<receipt>';

      fxpay.purchase('123', function(err) {
        assert.equal(receiptAdd._receipt, receipt);
        done(err);
      });

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

      fxpay.purchase('123', function(err) {
        assert.equal(err, 'ADD_RECEIPT_ERROR');
        done();
      });

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


  describe('init(): receipt validation', function() {

    // This is an encoded JWT receipt for a test in-app purchase.
    var receipt = 'eyJhbGciOiAiUlMyNTYiLCAidHlwIjogIkpXVCIsICJqa3UiOiAiaH' +
      'R0cHM6Ly9tYXJrZXRwbGFjZS1kZXYtY2RuLmFsbGl6b20ub3JnL3B1YmxpY19rZXlz' +
      'L3Rlc3Rfcm9vdF9wdWIuandrIn0.eyJpc3MiOiAiaHR0cHM6Ly9tYXJrZXRwbGFjZS' +
      '1kZXYtY2RuLmFsbGl6b20ub3JnL3B1YmxpY19rZXlzL3Rlc3Rfcm9vdF9wdWIuandr' +
      'IiwgInByaWNlX2xpbWl0IjogIjEwMCIsICJqd2siOiBbeyJhbGciOiAiUlNBIiwgIm' +
      '1vZCI6ICJBTVZnck9VWkIxeXQwMmxld1F4MHJjLTM5dEZkRkVfLW1GX0oxSG1NZ2kt' +
      'R2xQOEMxTWJqY212WWwwZFZXeHRvNlZPYnBncWo5QVM5NVZJQmdMZ0tmSXVUQkV3S2' +
      'kzT3FrNEp2aDI5ZjF6VWNYQ3lfeXV5d09WX1gzNWxPaWRRYUdmaU1KaVhXT0FVZngz' +
      'YnNMZEw4Mk0wRjU0cGRmN2N3bGlQaUFGYkNhM0hMOGNaQ3pIeU9sSmhBY3lWSElOd0' +
      'xabE02SElad1JLeG1VdzhuRlpJVWREb2VjWUVEREc0SkJqLXN1MmtwVzRYTW15RHNH' +
      'TGdNZ290Si15Z0lxbnduWFkwcFRVUTVWM245aHE3YzZzSW5TNk51dXZhUWhUX3I1dm' +
      'FBS3VycHdSOS0zejRpbXNRV2FTVm1tMzZrMnZ3Y1ZEWldHdkR6UG1xdW9lSFZzekE0' +
      'dXI4IiwgImV4cCI6ICJBUUFCIiwgImtpZCI6ICJzaWduZXIuc3RhZ2UuYWRkb25zLn' +
      'BoeDEubW96aWxsYS5jb20ifV0sICJleHAiOiAxNDE2MzU4NzY4LCAiaWF0IjogMTM4' +
      'NDgyMjc2OCwgInR5cCI6ICJjZXJ0aWZpZWQta2V5IiwgIm5iZiI6IDEzODQ4MjI3Nj' +
      'h9.nJ1qnaEaXhnTevXDC8b1FKQeWU4iQ3Qld44Oohx9IwSr7LkI5uGpAlCilYoumtK' +
      'f0GiNYHiB_IAXnT_Pez15CtE_tsu9Xy4fl0X5pll5hh9wKo7Dnkxu9uJwNiNE8vuot' +
      'vKR7SfYukeMEwE3nHfEREFU87Frs8wUgauxWo880G88lkaT20AArebmpg_I_iH8ldl' +
      'bSj05iAocDbzjKSHsDmryqZzqLFFV5qwXmOCtTRGWNnhug-eiWmZnDqukA41tWF_OD' +
      '_paP9EM8iP2vmpSNVhavkrQKk2v6-U5VYzueSMXqvk964yHunrwUCktFWIys1ItNpw' +
      'DE9Fv5_36IPkHAg~eyJqa3UiOiAiaHR0cHM6Ly9tYXJrZXRwbGFjZS1kZXYtY2RuLm' +
      'FsbGl6b20ub3JnL3B1YmxpY19rZXlzL3Rlc3Rfcm9vdF9wdWIuandrIiwgInR5cCI6' +
      'ICJKV1QiLCAiYWxnIjogIlJTMjU2In0.eyJwcm9kdWN0IjogeyJ1cmwiOiAiaHR0cD' +
      'ovL2JvYXI0NDg1LnRlc3RtYW5pZmVzdC5jb20iLCAic3RvcmVkYXRhIjogImNvbnRy' +
      'aWI9Mjk3JmlkPTUwMDQxOSZpbmFwcF9pZD0xIn0sICJpc3MiOiAiaHR0cHM6Ly9wYX' +
      'ltZW50cy1hbHQuYWxsaXpvbS5vcmciLCAidmVyaWZ5IjogImh0dHBzOi8vcmVjZWlw' +
      'dGNoZWNrLXBheW1lbnRzLWFsdC5hbGxpem9tLm9yZy92ZXJpZnkvIiwgImRldGFpbC' +
      'I6ICJodHRwczovL3BheW1lbnRzLWFsdC5hbGxpem9tLm9yZy9hcGkvdjEvcmVjZWlw' +
      'dHMvcmVpc3N1ZS8iLCAicmVpc3N1ZSI6ICJodHRwczovL3BheW1lbnRzLWFsdC5hbG' +
      'xpem9tLm9yZy9hcGkvdjEvcmVjZWlwdHMvcmVpc3N1ZS8iLCAidXNlciI6IHsidHlw' +
      'ZSI6ICJkaXJlY3RlZC1pZGVudGlmaWVyIiwgInZhbHVlIjogImFub255bW91cy11c2' +
      'VyIn0sICJleHAiOiAxNDE4NjYwMDM2LCAiaWF0IjogMTQwMjkzNTIzNiwgInR5cCI6' +
      'ICJwdXJjaGFzZS1yZWNlaXB0IiwgIm5iZiI6IDE0MDI5MzUyMzZ9.BN9NWnGurtMNn' +
      'CSX8U8c6Eh0YnaYr7EzBmlKaS8OD5EZrZLCxeeUQibstF-A8HKN3sZxxRuXQY_0xJz' +
      'sCm2P9MCSw21oL3Ag4OJu9oiTNfxr33wIGr3aKfE0w1gN9f0VEGwZLxlutwk7LogIq' +
      '6jCKirQ999wWQcqrvRYy73wzQRXCmGk15mOcEYkTKxlrLgjKRI_YqP_xiVTj8LjOxN' +
      'w4TQ5ojIvvgmzvAWR96v0po_ycXRjJ2Zy6sNPiDyKHmMVPuvTYKnwSJ3f-W4wbpRI9' +
      'TWmm_18PF8UZk-RejKSOP1UP2rpOdlKjdSHS_oSlMso2maa5gJ3S5DXOGvURemPgg';

    beforeEach(function() {
      appSelf.init();
      fxpay.configure({
        appId: 500419,
        receiptCheckSites: ['https://receiptcheck-payments-alt.allizom.org']
      });
    });

    it('posts receipt for validation', function(done) {
      appSelf.receipts = [receipt];

      server.respondWith(
        'POST', /.*/,
        function(request) {
          assert.equal(request.requestBody, receipt);
          request.respond(200, {"Content-Type": "application/json"},
                          '{"status": "valid"}');
        });

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {},
        onrestore: function(err, info) {
          if (!err) {
            assert.equal(info.productId, '1');
          }
          done(err);
        }
      });

      appSelf.onsuccess();
      server.respond();

    });

    it('calls back with validation error', function(done) {
      appSelf.receipts = [receipt];

      server.respondWith(
        'POST', /.*/,
        [200, {"Content-Type": "application/json"},
         '{"status": "invalid", "reason": "ERROR_DECODING"}']);

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {},
        onrestore: function(err, info) {
          if (!err) {
            assert.equal(err, 'INVALID_RECEIPT');
          }
          done();
        }
      });

      appSelf.onsuccess();
      server.respond();

    });

  });


  describe('verifyReceiptData()', function() {
    var appId = '44';
    var receiptCheckSite = 'https://niceverifier.org';

    function receipt(opt) {
      opt = opt || {};
      opt.data = opt.data || {
        product: {
          storedata: (opt.storedata || 'id=' + appId + '&inapp_id=1')
        },
        verify: opt.verify || receiptCheckSite + '/verify/'
      };
      opt.content = opt.content || btoa(JSON.stringify(opt.data));
      return 'jwtAlgo.' + opt.content + '.jwtSig';
    }

    beforeEach(function() {
      fxpay.configure({
        appId: appId,
        receiptCheckSites: [receiptCheckSite]
      });
    });

    it('fails on non-strings', function(done) {
      fxpay.verifyReceiptData({not: 'a receipt'}, function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on too many key segments', function(done) {
      fxpay.verifyReceiptData('one~too~many', function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on not enough JWT segments', function(done) {
      fxpay.verifyReceiptData('one.two', function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on invalid base64 encoding', function(done) {
      fxpay.verifyReceiptData(receipt({content: 'not%valid&&base64'}),
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on invalid JSON', function(done) {
      fxpay.verifyReceiptData('jwtAlgo.' + btoa('^not valid JSON') + '.jwtSig',
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on missing product', function(done) {
      fxpay.verifyReceiptData('jwtAlgo.' + btoa(JSON.stringify({})) + '.jwtSig',
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on missing storedata', function(done) {
      fxpay.verifyReceiptData('jwtAlgo.' + btoa(JSON.stringify({
                                product: {}
                              })) + '.jwtSig',
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on non-string storedata', function(done) {
      fxpay.verifyReceiptData(receipt({storedata: {}}),
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on corrupted storedata', function(done) {
      fxpay.verifyReceiptData(receipt({storedata: 'not%a!valid(string'}),
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('handles malformed storedata', function(done) {
      fxpay.verifyReceiptData(receipt({storedata: '&&&'}),
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on missing storedata', function(done) {
      fxpay.verifyReceiptData(receipt({storedata: 'foo=baz&barz=zonk'}),
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on disallowed app ID', function(done) {
      fxpay.configure({
        appId: '22'  // wrong ID.
      });
      fxpay.verifyReceiptData(receipt(), function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('allows foreign app receipts with a setting', function(done) {
      fxpay.configure({
        appId: '22',  // wrong ID which would normally cause an error.
        allowAnyAppReceipt: true
      });
      fxpay.verifyReceiptData(receipt(), function(err) {
        done(err);
      });
    });

    it('fails on disallowed receipt check URLs', function(done) {
      fxpay.verifyReceiptData(receipt({verify: 'http://mykracksite.ru'}),
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('passes through receipt data', function(done) {
      var productId = '321';
      var storedata = 'id=' + appId + '&inapp_id=' + productId;
      fxpay.verifyReceiptData(receipt({storedata: storedata}),
                              function(err, data, info) {
        if (!err) {
          assert.equal(info.productId, productId);
          assert.equal(data.product.storedata, storedata);
        }
        done(err);
      });
    });

    it('converts numeric app IDs to strings', function(done) {
      fxpay.configure({
        appId: parseInt(appId, 10)
      });
      fxpay.verifyReceiptData(receipt(), function(err, data, info) {
        done(err);
      });
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
  receipts: [],
  addReceipt: function(receipt) {
    receiptAdd._receipt = receipt;
    return receiptAdd;
  },
  onsuccess: function() {},
  onerror: function() {},
  init: function() {
    this.error = null;
    this.receipts = [];
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
