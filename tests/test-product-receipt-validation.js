define([
  'errors',
  'fxpay',
  'helper',
  'settings',
  'utils'
], function(errors, fxpay, helper, settings, utils) {

  describe('product.validateReceipt()', function() {
    var defaultProductUrl = 'http://boar4485.testmanifest.com';
    var receipt = makeReceipt();

    beforeEach(function() {
      helper.setUp();
      helper.appSelf.origin = defaultProductUrl;
      fxpay.configure({
        appSelf: helper.appSelf,
        receiptCheckSites: [
          'https://fake-receipt-check-server.net',
        ]
      });
    });

    afterEach(function() {
      helper.tearDown();
      window.localStorage.clear();
    });

    it('succeeds for valid receipts', function(done) {
      helper.appSelf.receipts = [receipt];

      setUpReceiptCheck({
        onValidationRequest: function(requestBody) {
          assert.equal(requestBody, receipt);
        },
      });

      fxpay.getProduct(helper.apiProduct.guid).then(function(product) {
        assert.equal(product.productId, helper.apiProduct.guid);
        assert.equal(product.name, helper.apiProduct.name);
        assert.equal(product.smallImageUrl, helper.apiProduct.logo_url);
        assert.typeOf(product.receiptInfo, 'object');
        return product.validateReceipt();
      }).then(function(product) {
        assert.equal(product.receiptInfo.status, 'ok');
        assert.equal(product.receiptInfo.receipt, receipt);
        done();
      }).catch(done);

    });

    it('finds receipts in local storage', function(done) {
      window.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify([receipt]));

      setUpReceiptCheck();

      fxpay.getProduct(helper.apiProduct.guid).then(function(product) {
        return product.validateReceipt();
      }).then(function(product) {
        assert.equal(product.productId, helper.apiProduct.guid);
        done();
      }).catch(done);

    });

    it('fails on validation errors', function(done) {
      helper.appSelf.receipts = [receipt];
      var receiptResponse = {status: "invalid", reason: "ERROR_DECODING"};

      setUpReceiptCheck({
        validatorResponse: receiptResponse,
      });

      fxpay.getProduct(helper.apiProduct.guid).then(function(product) {
        return product.validateReceipt();
      }).catch(function(error) {
        assert.instanceOf(error, errors.InvalidReceipt);
        assert.equal(error.productInfo.productId, helper.apiProduct.guid);
        assert.equal(error.productInfo.receiptInfo.status,
                     receiptResponse.status);
        assert.equal(error.productInfo.receiptInfo.reason,
                     receiptResponse.reason);
        done();
      }).catch(done);

    });

    it('fails on validation service errors', function(done) {
      helper.appSelf.receipts = [makeReceipt()];

      setUpReceiptCheck({
        onValidationResponse: function(request) {
          request.respond(500, {}, 'Internal Error');
        },
      });

      fxpay.getProduct(helper.apiProduct.guid).then(function(product) {
        return product.validateReceipt();
      }).catch(function(error) {
        assert.instanceOf(error, errors.BadApiResponse);
        assert.typeOf(error.productInfo, 'object');
        assert.equal(error.productInfo.productId, helper.apiProduct.guid);
        done();
      }).catch(done);

    });

    it('fails when receipt is missing', function(done) {
      helper.appSelf.receipts = [];
      setUpReceiptCheck();

      fxpay.getProduct(helper.apiProduct.guid).then(function(product) {
        return product.validateReceipt();
      }).then(function() {
        done(Error('unexpected success'));
      }).catch(function(error) {
        assert.instanceOf(error, errors.InvalidReceipt);
        assert.include(error.message, 'could not find installed receipt');
        done();
      }).catch(done);

    });

    it('ignores malformed receipts', function(done) {
      helper.appSelf.receipts = ['<malformed receipt>'];

      setUpReceiptCheck();

      fxpay.getProduct(helper.apiProduct.guid).then(function(product) {
        return product.validateReceipt();
      }).catch(function(error) {
        assert.instanceOf(error, errors.InvalidReceipt);
        assert.typeOf(error.productInfo, 'object');
        done();
      }).catch(done);

    });

    it('validates test receipts', function(done) {

      var testReceipt = makeReceipt({}, {
        typ: 'test-receipt',
        iss: 'https://payments-alt.allizom.org',
        verify: 'https://fake-receipt-check-server.net/' +
                'developers/test-receipt/',
      });
      helper.appSelf.receipts = [testReceipt];

      fxpay.configure({fakeProducts: true});

      setUpReceiptCheck({
        fetchProductUrl: new RegExp(
          'http(s)?://[^/]+/api/v1/payments/stub-in-app-products/' +
          helper.apiProduct.guid + '/'),
        verifyUrl: new RegExp(
          'https://fake-receipt-check-server\\.net/developers/test-receipt/'),
        onValidationRequest: function(requestBody) {
          assert.equal(requestBody, testReceipt);
        },
      });

      fxpay.getProduct(helper.apiProduct.guid, {
        fetchStubs: true,
      }).then(function(product) {
        return product.validateReceipt();
      }).then(function(product) {
        assert.equal(product.productId, helper.apiProduct.guid);
        assert.equal(product.name, helper.apiProduct.name);
        assert.equal(product.smallImageUrl, helper.apiProduct.logo_url);
        done();
      }).catch(done);

    });

    it('can still succeed from init', function(done) {
      helper.appSelf.receipts = [receipt];

      setUpReceiptCheck({
        fetchAllProducts: true,
        onValidationRequest: function(requestBody) {
          assert.equal(requestBody, receipt);
        },
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
            assert.equal(info.receiptInfo.receipt, receipt);
          }
          done(err);
        }
      });
    });

    it('can still fail from init', function(done) {
      helper.appSelf.receipts = [receipt];

      setUpReceiptCheck({
        fetchAllProducts: true,
        onValidationResponse: function(request) {
          request.respond(500, {}, 'Internal Error');
        },
      });

      fxpay.init({
        onerror: done,
        oninit: function() {},
        onrestore: function(err, info) {
          assert.instanceOf(err, errors.BadApiResponse);
          assert.typeOf(info, 'object');
          done();
        }
      });

    });


    function setUpReceiptCheck(opt) {
      opt = utils.defaults(opt, {
        fetchProductUrl: new RegExp(
            'http(s)?://[^/]+/api/v1/payments/' +
            encodeURIComponent(helper.appSelf.origin) + '/in-app/' +
            helper.apiProduct.guid + '/'),
        fetchAllProducts: false,
        validatorResponse: undefined,
        onValidationRequest: function() {},
        onValidationResponse: undefined,
        verifyUrl: undefined,
      });

      // When working with promises, we need to define responses up front
      // and respond as each request comes in.
      helper.server.respondImmediately = true;

      if (opt.fetchAllProducts) {
        // When testing init, we need to respond to fxpay.getProducts()
        helper.server.respondWith(
          'GET', helper.settings.apiUrlBase + helper.settings.apiVersionPrefix +
                   '/payments/' + encodeURIComponent(defaultProductUrl) +
                   '/in-app/?active=1',
          [200, {"Content-Type": "application/json"},
          JSON.stringify({
            meta: {
              next: null,
              previous: null,
              total_count: 1,
              offset: 0,
              limit: 25,
            },
            objects: [helper.apiProduct]
          })]);
      }

      // Respond to fetching the product info related to the receipt.
      helper.server.respondWith('GET', opt.fetchProductUrl,
                                function(request) {
        request.respond(200, {"Content-Type": "application/json"},
                        JSON.stringify(helper.apiProduct));
      });

      var validator = new helper.ReceiptValidator({
        verifyUrl: opt.verifyUrl,
        onRequest: opt.onValidationRequest,
        response: opt.validatorResponse,
        onValidationResponse: opt.onValidationResponse,
      });
      validator.finish();

    }


    function makeReceipt(overrides, receiptData) {
      overrides = utils.defaults(overrides, {
        productUrl: defaultProductUrl,
        storedata: 'contrib=297&id=500419&inapp_id=' + helper.apiProduct.guid,
      });
      return helper.makeReceipt(receiptData, overrides);
    }

  });
});
