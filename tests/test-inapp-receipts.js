describe('fxpay.init(): receipts', function() {
  var utils = fxpay.getattr('utils');
  var defaultProductUrl = 'http://boar4485.testmanifest.com';
  var receipt = makeReceipt();

  beforeEach(function() {
    helper.setUp();
    helper.appSelf.origin = defaultProductUrl;
    fxpay.configure({
      appSelf: helper.appSelf,
      receiptCheckSites: [
        'https://receiptcheck-payments-alt.allizom.org',
        'https://payments-alt.allizom.org',
      ]
    });
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('validates receipt and gets product info', function(done) {
    helper.appSelf.receipts = [receipt];

    var validator = new helper.ReceiptValidator({
      onRequest: function(requestBody) {
        assert.equal(requestBody, receipt);
      },
    });

    helper.server.respondWith(
      'GET', 'https://payments-alt.allizom.org' +
          '/api/v1/payments/http%3A%2F%2Fboar4485.testmanifest.com/in-app/1/',
      function(request) {
        request.respond(200, {"Content-Type": "application/json"},
                        JSON.stringify(helper.apiProduct));
      });

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {},
      onrestore: function(err, info) {
        if (!err) {
          assert.equal(info.productId, helper.apiProduct.guid);
          assert.equal(info.name, helper.apiProduct.name);
          assert.equal(info.smallImageUrl, helper.apiProduct.logo_url);
          assert.equal(info.receiptInfo.status, 'ok');
        }
        done(err);
      }
    });

    validator.finish();
    helper.server.respond();

  });

  it('posts local storage receipt for validation', function(done) {
    helper.appSelf.receipts = [receipt];

    var validator = new helper.ReceiptValidator();

    helper.server.respondWith(
      'GET', /.*/,
      function(request) {
        request.respond(200, {"Content-Type": "application/json"},
                        JSON.stringify(helper.apiProduct));
      });

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {},
      onrestore: function(err, info) {
        if (!err) {
          assert.equal(info.productId, helper.apiProduct.guid);
        }
        done(err);
      }
    });

    validator.finish();
    helper.server.respond();

  });

  it('calls back with validation error', function(done) {
    helper.appSelf.receipts = [receipt];
    var receiptResponse = {status: "invalid", reason: "ERROR_DECODING"};

    var validator = new helper.ReceiptValidator({
      response: receiptResponse,
    });

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {},
      onrestore: function(err, info) {
        assert.instanceOf(err, fxpay.errors.InvalidReceipt);
        assert.equal(info.productId, '1');
        assert.equal(info.receiptInfo.status, receiptResponse.status);
        assert.equal(info.receiptInfo.reason, receiptResponse.reason);
        done();
      }
    });

    validator.finish();

  });

  it('returns info object for receipt errors', function(done) {
    helper.appSelf.receipts = ['<malformed receipt>'];

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {},
      onrestore: function(err, info) {
        assert.instanceOf(err, fxpay.errors.InvalidReceipt);
        assert.typeOf(info, 'object');
        done();
      }
    });

    helper.appSelf.onsuccess();
  });

  it('validates test receipt and gets stub products', function(done) {
    var testReceipt = helper.makeReceipt({
      typ: 'test-receipt',
      iss: 'https://payments-alt.allizom.org',
      verify: 'https://payments-alt.allizom.org/developers/test-receipt/',
    });
    helper.appSelf.receipts = [testReceipt];

    var validator = new helper.ReceiptValidator({
      verifyUrl: new RegExp(
        'https://payments-alt\\.allizom\\.org/developers/test-receipt/'),
      onRequest: function(requestBody) {
        assert.equal(requestBody, testReceipt);
      },
    });

    helper.server.respondWith(
      'GET', new RegExp(
        'https://payments-alt\\.allizom\\.org' +
        '/api/v1/payments/stub-in-app-products/1/'),
      function(request) {
        request.respond(200, {"Content-Type": "application/json"},
                        JSON.stringify(helper.apiProduct));
      });

    fxpay.configure({fakeProducts: true});

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {},
      onrestore: function(err, info) {
        if (!err) {
          assert.equal(info.productId, helper.apiProduct.guid);
          assert.equal(info.name, helper.apiProduct.name);
          assert.equal(info.smallImageUrl, helper.apiProduct.logo_url);
        }
        done(err);
      }
    });

    validator.finish();
    helper.server.respond();
  });

  it('calls back with API error from fetching products', function(done) {
    helper.appSelf.receipts = [makeReceipt()];

    var validator = new helper.ReceiptValidator();

    // Fetch product info:
    helper.server.respondWith('GET', new RegExp('.*/payments/.*/in-app/.*'),
                              [500, {}, 'Internal Error']);

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {},
      onrestore: function(err) {
        assert.instanceOf(err, fxpay.errors.BadAPIResponse);
        done();
      }
    });

    validator.finish();
    helper.server.respond();
  });


  function makeReceipt(overrides, receiptData) {
    overrides = utils.defaults(overrides, {
      productUrl: defaultProductUrl,
    });
    return helper.makeReceipt(receiptData, overrides);
  }

});
