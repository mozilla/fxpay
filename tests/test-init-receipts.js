describe('fxpay.init(): receipt validation', function() {
  var receipt = helper.makeReceipt();

  beforeEach(function() {
    helper.setUp();
    helper.appSelf.origin = 'http://boar4485.testmanifest.com';
    fxpay.configure({
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

    helper.server.respondWith(
      'POST', new RegExp(
        'https://receiptcheck-payments-alt\\.allizom\\.org/verify/'),
      function(request) {
        assert.equal(request.requestBody, receipt);
        request.respond(200, {"Content-Type": "application/json"},
                        '{"status": "ok"}');
      });

    helper.server.respondWith(
      'GET', new RegExp(
        'https://payments-alt\\.allizom\\.org' +
        '/api/v1/payments/http%3A%2F%2Fboar4485\\.testmanifest\\.com' +
        '/in-app/1/'),
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
        }
        done(err);
      }
    });

    helper.appSelf.onsuccess();
    helper.server.respond();
    helper.server.respond();

  });

  it('posts local storage receipt for validation', function(done) {
    helper.appSelf.receipts = [receipt];

    helper.server.respondWith(
      'POST', /.*/,
      function(request) {
        assert.equal(request.requestBody, receipt);
        request.respond(200, {"Content-Type": "application/json"},
                        '{"status": "ok"}');
      });

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

    helper.appSelf.onsuccess();
    helper.server.respond();
    helper.server.respond();

  });

  it('calls back with validation error', function(done) {
    helper.appSelf.receipts = [receipt];

    helper.server.respondWith(
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

    helper.appSelf.onsuccess();
    helper.server.respond();

  });

  it('returns info object for receipt errors', function(done) {
    helper.appSelf.receipts = ['<malformed receipt>'];

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

    helper.appSelf.onsuccess();
  });

  it('validates test receipt and gets stub products', function(done) {
    var testReceipt = helper.makeReceipt({
      typ: 'test-receipt',
      iss: 'https://payments-alt.allizom.org',
      verify: 'https://payments-alt.allizom.org/developers/test-receipt/',
    });
    helper.appSelf.receipts = [testReceipt];

    helper.server.respondWith(
      'POST', new RegExp(
        'https://payments-alt\\.allizom\\.org/developers/test-receipt/'),
      function(request) {
        assert.equal(request.requestBody, testReceipt);
        request.respond(200, {"Content-Type": "application/json"},
                        '{"status": "ok"}');
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

    helper.appSelf.onsuccess();
    helper.server.respond();
    helper.server.respond();
  });

  it('calls back with API error from fetching products', function(done) {
    helper.appSelf.receipts = [helper.makeReceipt()];

    // Receipt check:
    helper.server.respondWith(
      'POST', /.*/,
      [200, {"Content-Type": "application/json"}, '{"status": "ok"}']);

    // Fetch product info:
    helper.server.respondWith('GET', new RegExp('.*/payments/.*/in-app/.*'),
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

    helper.appSelf.onsuccess();
    helper.server.respond();
    helper.server.respond();
  });

});
