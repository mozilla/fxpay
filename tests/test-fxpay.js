describe('fxpay', function () {
  var settings;
  var server;
  var someAppOrigin = 'app://my-app';
  // Product info as returned from a GET request to the API.
  var apiProduct = {guid: 'server-guid', name: "Name from API",
                    logo_url: "img.jpg"};

  beforeEach(function() {
    console.log('beginEach');
    server = sinon.fakeServer.create();
    settings = fxpay.configure({
      apiUrlBase: 'http://tests-should-never-hit-this.com',
      // Start with this true because init() sets it and it's
      // cumbersome to re-init some tests.
      hasAddReceipt: true,
      initError: null,
      mozApps: mozAppsStub
    }, {
      reset: true
    });
    window.localStorage.clear();
    appSelf.init();
  });

  afterEach(function() {
    server.restore();
  });

  describe('init()', function() {

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

    it('should error when receipt storage does not exist', function (done) {
      delete appSelf.addReceipt;  // older FxOSs do not have this.

      fxpay.configure({
        localStorage: null  // no fallback.
      });

      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
          done();
        }
      });

      appSelf.onsuccess();
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

    it('should error when missing systemXHR permission', function (done) {
      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'MISSING_XHR_PERMISSION');
          done();
        }
      });

      delete appSelf.manifest.permissions.systemXHR;
      appSelf.onsuccess();
    });

    it('should error when app has no permissions', function (done) {
      fxpay.init({
        onerror: function(err) {
          assert.equal(err, 'MISSING_XHR_PERMISSION');
          done();
        }
      });

      delete appSelf.manifest.permissions;
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
      fxpay.configure({
        appSelf: appSelf,
        mozPay: mozPay
      });
    });

    afterEach(function() {
      mozPay.reset();
      receiptAdd.reset();
    });

    function setUpLocStorAddReceipt(done) {
      // Set up a purchase where mozApps does not support addReceipt().
      delete appSelf.addReceipt;

      // Re-initialize to detect lack of addReceipt().
      fxpay.init({
        oninit: function() {},
        onerror: function(err) {
          done(err);
        }
      });

      appSelf.onsuccess();
    }

    function finishPurchaseOk(receipt, opt) {
      opt = opt || {};
      opt.fetchProductsPattern = (opt.fetchProductsPattern ||
                                  new RegExp('.*/payments/.*/in-app/.*'))

      // Respond to fetching the JWT.
      server.respondWith('POST', /.*\/webpay\/inapp\/prepare/, productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      // Respond to validating the transaction.
      server.respondWith('GET', /.*\/transaction\/XYZ/,
                         transactionData({receipt: receipt}));
      server.respond();

      // Respond to getting product info.
      server.respondWith('GET', opt.fetchProductsPattern,
                         [200, {"Content-Type": "application/json"},
                          JSON.stringify(apiProduct)]);

      receiptAdd.onsuccess();
      server.respond();
    }

    it('should pass through init errors', function (done) {
      // Trigger an init error:
      fxpay.configure({
        mozApps: {},  // invalid mozApps.
      });
      fxpay.init({
        onerror: function(err) {
          console.log('ignoring err', err);
        }
      });

      // Try to start a purchase.
      fxpay.purchase(apiProduct.guid, function(err, info) {
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        assert.equal(typeof info, 'object');
        done();
      });
    });

    it('should send a JWT to mozPay', function (done) {
      var webpayJWT = '<base64 JWT>';
      var productId = 'some-guid';
      var cfg = {
        apiUrlBase: 'https://not-the-real-marketplace',
        apiVersionPrefix: '/api/v1'
      };
      fxpay.configure(cfg);

      fxpay.purchase(productId, function(err, info) {
        assert.ok(mozPay.called);
        assert.ok(mozPay.calledWith([webpayJWT]), mozPay.firstCall);
        assert.equal(info.productId, apiProduct.guid);
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

      server.respondWith('GET', cfg.apiUrlBase + '/transaction/XYZ',
                         transactionData());
      server.respond();

      server.respondWith('GET', new RegExp('.*/payments/.*/in-app/.*'),
                         [200, {"Content-Type": "application/json"},
                          JSON.stringify(apiProduct)]);

      receiptAdd.onsuccess();
      server.respond();
    });

    it('should timeout polling the transaction', function (done) {
      var productId = 'some-guid';

      fxpay.purchase(productId, function(err, info) {
        assert.equal(err, 'TRANSACTION_TIMEOUT');
        assert.equal(info.productId, productId);
        done();
      }, {
        maxTries: 2,
        pollIntervalMs: 1
      });

      // Respond to fetching the JWT.
      server.respondWith('POST', /http.*\/webpay\/inapp\/prepare/,
                         productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      server.autoRespond = true;
      server.respondWith('GET', /http.*\/transaction\/XYZ/,
                         transactionData({status: 'incomplete'}));
      server.respond();
    });

    it('should call back with mozPay error', function (done) {
      var productId = 'some-guid';

      fxpay.purchase(productId, function(err, info) {
        assert.equal(err, 'DIALOG_CLOSED_BY_USER');
        assert.equal(info.productId, productId);
        done();
      });

      // Respond to fetching the JWT.
      server.respondWith('POST', /.*webpay\/inapp\/prepare/, productData());
      server.respond();

      var domReq = mozPay.returnValues[0];
      domReq.error = {name: 'DIALOG_CLOSED_BY_USER'};
      domReq.onerror();
    });

    it('should report invalid transaction state', function (done) {

      fxpay.purchase(apiProduct.guid, function(err) {
        assert.equal(err, 'INVALID_TRANSACTION_STATE');
        done();
      });

      // Respond to fetching the JWT.
      server.respondWith('POST', /http.*\/webpay\/inapp\/prepare/,
                         productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      // Respond to polling the transaction.
      server.respondWith(
        'GET', /http.*\/transaction\/XYZ/,
        transactionData({status: 'THIS_IS_NOT_A_VALID_STATE'}));
      server.respond();

      receiptAdd.onsuccess();
    });

    it('should error when mozPay is not supported', function (done) {
      fxpay.configure({mozPay: undefined});

      fxpay.purchase(apiProduct.guid, function(err, info) {
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        assert.equal(typeof info, 'object');
        done();
      });
    });

    it('should add receipt to device with addReceipt', function (done) {
      var receipt = '<receipt>';

      fxpay.purchase(apiProduct.guid, function(err) {
        assert.equal(receiptAdd._receipt, receipt);
        done(err);
      });

      finishPurchaseOk(receipt);
    });

    it('should call back with complete product info', function (done) {

      fxpay.purchase(apiProduct.guid, function(err, info) {
        if (!err) {
          assert.equal(info.productId, apiProduct.guid);
          assert.equal(info.name, apiProduct.name);
          assert.equal(info.smallImageUrl, apiProduct.logo_url);
        }
        done(err);
      });

      finishPurchaseOk('<receipt>');
    });

    it('should fetch stub products when using fake products', function (done) {
      fxpay.configure({fakeProducts: true});

      fxpay.purchase(apiProduct.guid, function(err, info) {
        if (!err) {
          assert.equal(info.productId, apiProduct.guid);
          assert.equal(info.name, apiProduct.name);
          assert.equal(info.smallImageUrl, apiProduct.logo_url);
        }
        done(err);
      });

      finishPurchaseOk('<receipt>', {
        fetchProductsPattern: /.*\/stub-in-app-products\/.*/
      });
    });

    it('should add receipt to device with localStorage', function (done) {
      var receipt = '<receipt>';

      setUpLocStorAddReceipt(done);

      // Without addReceipt(), receipt should go in localStorage.

      fxpay.purchase(apiProduct.guid, function(err) {
        if (!err) {
          assert.equal(
            JSON.parse(
              window.localStorage.getItem(settings.localStorageKey))[0],
            receipt);
        }
        done(err);
      });

      finishPurchaseOk(receipt);
    });

    it('should not add dupes to localStorage', function (done) {
      var receipt = '<receipt>';

      setUpLocStorAddReceipt(done);

      // Set up an already stored receipt.
      window.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify([receipt]));

      fxpay.purchase(apiProduct.guid, function(err) {
        if (!err) {
          var addedReceipts = JSON.parse(
            window.localStorage.getItem(settings.localStorageKey));
          // Make sure a new receipt wasn't added.
          assert.equal(addedReceipts.length, 1);
        }
        done(err);
      });

      finishPurchaseOk(receipt);
    });

    it('should pass through receipt errors', function (done) {

      fxpay.purchase(apiProduct.guid, function(err) {
        assert.equal(err, 'ADD_RECEIPT_ERROR');
        done();
      });

      // Respond to fetching the JWT.
      server.respondWith('POST', /.*\/webpay\/inapp\/prepare/, productData());
      server.respond();

      mozPay.returnValues[0].onsuccess();

      server.respondWith('GET', /.*\/transaction\/XYZ/, transactionData());
      server.respond();

      // Simulate a receipt installation error.
      receiptAdd.error = {name: 'ADD_RECEIPT_ERROR'};
      receiptAdd.onerror();
    });
  });


  describe('init(): receipt validation', function() {
    var receipt = makeReceipt();

    beforeEach(function() {
      appSelf.origin = 'http://boar4485.testmanifest.com';
      fxpay.configure({
        receiptCheckSites: [
          'https://receiptcheck-payments-alt.allizom.org',
          'https://payments-alt.allizom.org',
        ]
      });
    });

    it('validates receipt and gets product info', function(done) {
      appSelf.receipts = [receipt];

      server.respondWith(
        'POST', new RegExp(
          'https://receiptcheck-payments-alt\\.allizom\\.org/verify/'),
        function(request) {
          assert.equal(request.requestBody, receipt);
          request.respond(200, {"Content-Type": "application/json"},
                          '{"status": "ok"}');
        });

      server.respondWith(
        'GET', new RegExp(
          'https://payments-alt\\.allizom\\.org' +
          '/api/v1/payments/http%3A%2F%2Fboar4485\\.testmanifest\\.com' +
          '/in-app/1/'),
        function(request) {
          request.respond(200, {"Content-Type": "application/json"},
                          JSON.stringify(apiProduct));
        });

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {},
        onrestore: function(err, info) {
          if (!err) {
            assert.equal(info.productId, apiProduct.guid);
            assert.equal(info.name, apiProduct.name);
            assert.equal(info.smallImageUrl, apiProduct.logo_url);
          }
          done(err);
        }
      });

      appSelf.onsuccess();
      server.respond();
      server.respond();

    });

    it('posts local storage receipt for validation', function(done) {
      appSelf.receipts = [receipt];

      server.respondWith(
        'POST', /.*/,
        function(request) {
          assert.equal(request.requestBody, receipt);
          request.respond(200, {"Content-Type": "application/json"},
                          '{"status": "ok"}');
        });

      server.respondWith(
        'GET', /.*/,
        function(request) {
          request.respond(200, {"Content-Type": "application/json"},
                          JSON.stringify(apiProduct));
        });

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {},
        onrestore: function(err, info) {
          if (!err) {
            assert.equal(info.productId, apiProduct.guid);
          }
          done(err);
        }
      });

      appSelf.onsuccess();
      server.respond();
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
          assert.equal(err, 'INVALID_RECEIPT');
          assert.equal(info.productId, '1');
          done();
        }
      });

      appSelf.onsuccess();
      server.respond();

    });

    it('returns info object for receipt errors', function(done) {
      appSelf.receipts = ['<malformed receipt>'];

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {},
        onrestore: function(err, info) {
          assert.equal(err, 'INVALID_RECEIPT');
          assert.equal(typeof info, 'object');
          done();
        }
      });

      appSelf.onsuccess();
    });

    it('validates test receipt and gets stub products', function(done) {
      var testReceipt = makeReceipt({
        typ: 'test-receipt',
        iss: 'https://payments-alt.allizom.org',
        verify: 'https://payments-alt.allizom.org/developers/test-receipt/',
      });
      appSelf.receipts = [testReceipt];

      server.respondWith(
        'POST', new RegExp(
          'https://payments-alt\\.allizom\\.org/developers/test-receipt/'),
        function(request) {
          assert.equal(request.requestBody, testReceipt);
          request.respond(200, {"Content-Type": "application/json"},
                          '{"status": "ok"}');
        });

      server.respondWith(
        'GET', new RegExp(
          'https://payments-alt\\.allizom\\.org' +
          '/api/v1/payments/stub-in-app-products/1/'),
        function(request) {
          request.respond(200, {"Content-Type": "application/json"},
                          JSON.stringify(apiProduct));
        });

      fxpay.configure({fakeProducts: true});

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {},
        onrestore: function(err, info) {
          if (!err) {
            assert.equal(info.productId, apiProduct.guid);
            assert.equal(info.name, apiProduct.name);
            assert.equal(info.smallImageUrl, apiProduct.logo_url);
          }
          done(err);
        }
      });

      appSelf.onsuccess();
      server.respond();
      server.respond();
    });

    it('calls back with API error from fetching products', function(done) {
      appSelf.receipts = [makeReceipt()];

      // Receipt check:
      server.respondWith(
        'POST', /.*/,
        [200, {"Content-Type": "application/json"}, '{"status": "ok"}']);

      // Fetch product info:
      server.respondWith('GET', new RegExp('.*/payments/.*/in-app/.*'),
                         [500, {}, 'Internal Error']);

      fxpay.init({
        onerror: function(err) {
          done(err);
        },
        oninit: function() {},
        onrestore: function(err, info) {
          assert.equal(err, 'BAD_API_RESPONSE');
          done();
        }
      });

      appSelf.onsuccess();
      server.respond();
      server.respond();
    });

  });


  describe('getReceipts', function() {

    it('exposes mozApps receipts', function() {
      var receipt = '<receipt>';
      fxpay.configure({
        appSelf: {
          receipts: [receipt]
        }
      });
      var fetchedReceipts = fxpay.getReceipts();
      assert.equal(fetchedReceipts[0], receipt);
      assert.equal(fetchedReceipts.length, 1);
    });

    it('ignores missing receipts', function() {
      fxpay.configure({appSelf: {}});  // no receipts property
      var fetchedReceipts = fxpay.getReceipts();
      assert.equal(fetchedReceipts.length, 0);
    });

    it('gets mozApps receipts and localStorage ones', function() {
      var receipt1 = '<receipt1>';
      var receipt2 = '<receipt2>';

      fxpay.configure({
        appSelf: {
          receipts: [receipt1]
        }
      });
      window.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify([receipt2]));

      var fetchedReceipts = fxpay.getReceipts();
      assert.equal(fetchedReceipts[0], receipt1);
      assert.equal(fetchedReceipts[1], receipt2);
      assert.equal(fetchedReceipts.length, 2);
    });

    it('filters out dupe receipts', function() {
      var receipt1 = '<receipt1>';

      fxpay.configure({
        appSelf: {
          receipts: [receipt1]
        }
      });
      window.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify([receipt1]));

      var fetchedReceipts = fxpay.getReceipts();
      assert.equal(fetchedReceipts[0], receipt1);
      assert.equal(fetchedReceipts.length, 1);
    });

    it('handles initialization errors', function() {
      fxpay.configure({
        appSelf: null  // default state before initializaion.
      });
      var fetchedReceipts = fxpay.getReceipts();
      assert.equal(fetchedReceipts.length, 0);
    });

  });


  describe('verifyReceiptData()', function() {
    var receiptCheckSite = 'https://niceverifier.org';

    function receipt(overrides, receiptData) {
      overrides = overrides || {};
      receiptData = receiptData || {};

      receiptData.verify = (receiptData.verify ||
                            receiptCheckSite + '/verify/');
      overrides.productUrl = overrides.productUrl || someAppOrigin;

      return makeReceipt(receiptData, overrides);
    }

    beforeEach(function() {
      fxpay.configure({
        appSelf: appSelf,
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
      fxpay.verifyReceiptData(receipt({receipt: 'not%valid&&base64'}),
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
      fxpay.verifyReceiptData({}, function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('fails on missing product URL', function(done) {
      fxpay.verifyReceiptData(receipt(null,
                                      {product: {storedata: 'storedata'}}),
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

    it('fails on foreign product URL', function(done) {
      var data = receipt({productUrl: 'wrong-app'});
      fxpay.verifyReceiptData(data, function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('handles non-prefixed app origins', function(done) {
      appSelf.origin = 'app://the-origin';
      // TODO: remove this when fixed in Marketplace. bug 1034264.
      var data = receipt({productUrl: 'the-origin'});

      fxpay.verifyReceiptData(data, function(err) {
        done(err);
      });
    });

    it('handles properly prefixed app origins', function(done) {
      appSelf.origin = 'app://the-app';
      var data = receipt({productUrl: appSelf.origin});

      fxpay.verifyReceiptData(data, function(err) {
        done(err);
      });
    });

    it('handles HTTP hosted app origins', function(done) {
      appSelf.origin = 'http://hosted-app';
      var data = receipt({productUrl: appSelf.origin});

      fxpay.verifyReceiptData(data, function(err) {
        done(err);
      });
    });

    it('handles HTTPS hosted app origins', function(done) {
      appSelf.origin = 'https://hosted-app';
      var data = receipt({productUrl: appSelf.origin});

      fxpay.verifyReceiptData(data, function(err) {
        done(err);
      });
    });

    it('allows foreign app receipts with a setting', function(done) {
      fxpay.configure({
        allowAnyAppReceipt: true
      });
      var data = receipt({productUrl: 'wrong-app'});
      fxpay.verifyReceiptData(data, function(err) {
        done(err);
      });
    });

    it('allows wrong product URLs for test receipts', function(done) {
      // Only allow test receipts when fakeProducts is true.
      fxpay.configure({fakeProducts: true});
      fxpay.verifyReceiptData(receipt({productUrl: 'wrong-app'},
                                      {typ: 'test-receipt'}),
                              function(err) {
        done(err);
      });
    });

    it('fails on disallowed receipt check URLs', function(done) {
      fxpay.verifyReceiptData(receipt(null,
                                      {verify: 'http://mykracksite.ru'}),
                              function(err) {
        assert.equal(err, 'INVALID_RECEIPT');
        done();
      });
    });

    it('passes through receipt data', function(done) {
      var productId = 'some-guid';
      var productUrl = 'app://some-packaged-origin';
      var storedata = 'inapp_id=' + productId;
      appSelf.origin = productUrl;

      fxpay.verifyReceiptData(receipt({storedata: storedata,
                                       productUrl: productUrl}),
                              function(err, data, info) {
        if (!err) {
          assert.equal(info.productId, productId);
          assert.equal(info.productUrl, productUrl);
          assert.equal(data.product.storedata, storedata);
        }
        done(err);
      });
    });

    it('disallows test receipts when not testing', function(done) {
      fxpay.verifyReceiptData(receipt(null, {typ: 'test-receipt'}),
                              function(err, info) {
        assert.equal(err, 'TEST_RECEIPT_NOT_ALLOWED');
        assert.equal(typeof info, 'object');
        done();
      });
    });

  });


  describe('getProducts', function() {

    beforeEach(function() {
      fxpay.configure({
        appSelf: appSelf
      });
    });

    it('calls back with product info', function(done) {

      var serverObjects = [
        {"guid": "guid3", "app": "fxpay", "price_id": 237,
         "name": "Virtual Kiwi", "logo_url": "http://site/image1.png"},
        {"guid": "guid4", "app": "fxpay", "price_id": 238,
         "name": "Majestic Cheese", "logo_url": "http://site/image2.png"}
      ];
      var url = (settings.apiUrlBase + settings.apiVersionPrefix +
                 '/payments/' + encodeURIComponent(someAppOrigin) +
                 '/in-app/');

      server.respondWith(
        'GET', url,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({
           "meta": {"next": null, "previous": null, "total_count": 2,
                    "offset": 0, "limit": 25},
           "objects": serverObjects
         })]);

      fxpay.getProducts(function(err, products) {
        assert.equal(products[0].name, serverObjects[0].name);
        assert.equal(products[0].productId, serverObjects[0].guid);
        assert.equal(products[0].smallImageUrl, serverObjects[0].logo_url);
        assert.equal(products[1].name, serverObjects[1].name);
        assert.equal(products[1].productId, serverObjects[1].guid);
        assert.equal(products[1].smallImageUrl, serverObjects[1].logo_url);
        assert.equal(products.length, 2);
        done(err);
      });

      server.respond();
    });

    it('can retrieve fake products', function(done) {

      fxpay.configure({fakeProducts: true});

      var serverObjects = [
        {"guid": "guid1", "app": "fxpay", "price_id": 1,
         "name": "Clown Shoes", "logo_url": "http://site/image1.png"},
        {"guid": "guid2", "app": "fxpay", "price_id": 2,
         "name": "Belt and Suspenders", "logo_url": "http://site/image2.png"}
      ];
      var url = (settings.apiUrlBase + settings.apiVersionPrefix +
                 '/payments/stub-in-app-products/');

      server.respondWith(
        'GET', url,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({
           "meta": {"next": null, "previous": null, "total_count": 2,
                    "offset": 0, "limit": 25},
           "objects": serverObjects
         })]);

      fxpay.getProducts(function(err, products) {
        assert.equal(products[0].name, serverObjects[0].name);
        assert.equal(products[1].name, serverObjects[1].name);
        assert.equal(products.length, 2);
        done(err);
      });

      server.respond();
    });

    it('calls back with API errors', function(done) {

      server.respondWith('GET', /.*/, [404, {}, '']);

      fxpay.getProducts(function(err, products) {
        assert.equal(err, 'BAD_API_RESPONSE');
        assert.equal(products.length, 0);
        done();
      });

      server.respond();
    });

    it('should pass through init errors', function (done) {
      // Trigger an init error:
      fxpay.configure({
        mozApps: {},  // invalid mozApps.
      });
      fxpay.init({
        onerror: function(err) {
          console.log('ignoring err', err);
        }
      });

      fxpay.getProducts(function(err, products) {
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        assert.equal(products.length, 0);
        done();
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

    it('should send the library version with each request', function (done) {
      server.respondWith(
        'GET', /.*/,
        function(request) {
          assert.ok(fxpay.__version__);  // make sure it's defined.
          assert.equal(request.requestHeaders['x-fxpay-version'], fxpay.__version__);
          request.respond(200, {"Content-Type": "application/json"}, '{}');
        });

      api.get('/get', function(err, data) {
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


  function dispatchXhrEvent(xhr, eventName, bubbles, cancelable) {
    xhr.dispatchEvent(new sinon.Event(eventName, bubbles, cancelable, xhr));
    // Prevent future listening, like, in future tests.
    // Maybe this is fixed now?
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


  function makeReceipt(data, opt) {
    // Generate a pseudo web application receipt.
    // https://wiki.mozilla.org/Apps/WebApplicationReceipt
    data = data || {};
    opt = opt || {};

    // Fill in some defaults:
    data.typ = data.typ || 'purchase-receipt';
    data.iss = data.iss || 'https://payments-alt.allizom.org';
    data.verify = (data.verify ||
                   'https://receiptcheck-payments-alt.allizom.org/verify/');
    data.product = data.product || {
      url: opt.productUrl || 'http://boar4485.testmanifest.com',
      storedata: opt.storedata || 'contrib=297&id=500419&inapp_id=1'
    };
    data.user = data.user || {
      type: 'directed-identifier',
      value: 'anonymous-user'
    };

    // Make up some fake timestamps.
    data.iat = data.iat || 1402935236;
    data.exp = data.exp || 1418660036;
    data.nbf = data.nbf || 1402935236;

    // Make a URL safe base 64 encoded receipt:
    var receipt = (btoa(JSON.stringify(data)).replace(/\+/g, '-')
                   .replace(/\//g, '_').replace(/\=+$/, ''));

    // jwtKey and jwtSig are stubbed out here because they
    // are not used by the library.
    return 'jwtKey.' + (opt.receipt || receipt) + '.jwtSig';
  };


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
    init: function() {
      this.error = null;
      this.origin = someAppOrigin;
      this.manifest = {
        permissions: {
          systemXHR: {description: "Required to access payment API"}
        }
      };
      this.receipts = [];
      // This is the result of getSelf(). Setting it to this makes stubbing easier.
      this.result = this;

      this.addReceipt = function(receipt) {
        receiptAdd._receipt = receipt;
        return receiptAdd;
      };
    },
    onsuccess: function() {},
    onerror: function() {}
  };


  // https://developer.mozilla.org/en-US/docs/Web/API/Apps.getSelf
  var mozAppsStub = {
    getSelf: function() {
      return appSelf;
    }
  };

});
