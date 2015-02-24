describe('fxpay.validateAppReceipt()', function() {
  var defaultProductUrl = 'http://boar4485.testmanifest.com';
  var utils = fxpay.getattr('utils');

  beforeEach(function() {
    var receipt = makeReceipt();
    helper.setUp();
    helper.appSelf.origin = defaultProductUrl;
    helper.appSelf.receipts = [receipt];
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

  it('calls back for successful server validation', function(done) {
    var appId = '1234';
    var productUrl = helper.appSelf.origin;
    var receipt = makeReceipt({
      storedata: 'id=' + appId,
      productUrl: productUrl,
    });
    helper.appSelf.receipts = [receipt];

    var validator = new helper.ReceiptValidator({
      onRequest: function(requestBody) {
        assert.equal(requestBody, receipt);
      },
    });

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(productInfo.receiptInfo.status, 'ok');
      assert.equal(productInfo.productId, appId);
      assert.equal(productInfo.productUrl, productUrl);
      done(error);
    });

    validator.finish();
  });

  it('calls back for server validation errors', function(done) {
    var badResponse = {status: 'invalid', reason: 'ERROR_DECODING'};

    var validator = new helper.ReceiptValidator({
      response: badResponse,
    });

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(productInfo.receiptInfo.status, badResponse.status);
      assert.equal(productInfo.receiptInfo.reason, badResponse.reason);
      assert.equal(error, 'INVALID_RECEIPT');
      done();
    });

    validator.finish();
  });

  it('fails when origin does not match product URL', function(done) {
    helper.appSelf.origin = 'http://some-other-origin.net';

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'INVALID_RECEIPT');
      assert.equal(typeof productInfo, 'object');
      done();
    });

    validator.finish();
  });

  it('fails when receipt was issued by a disallowed store', function(done) {
    // Disallow all other stores:
    helper.appSelf.manifest.installs_allowed_from = [
      'https://my-benevolent-app-store.net',
    ];

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'INVALID_RECEIPT');
      assert.equal(typeof productInfo, 'object');
      done();
    });

    validator.finish();
  });

  it('fails when no stores are allowed', function(done) {
    // This is an unlikely case but we should honor it I suppose.
    helper.appSelf.manifest.installs_allowed_from = [];

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'INVALID_RECEIPT');
      assert.equal(typeof productInfo, 'object');
      done();
    });

    validator.finish();
  });

  it('allows any receipt with splat', function(done) {
    helper.appSelf.manifest.installs_allowed_from = ['*'];

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error) {
      done(error);
    });

    validator.finish();
  });

  it('converts empty installs_allowed_from to splat', function(done) {
    // Make this imply installs_allowed_from = ['*'].
    delete helper.appSelf.manifest.installs_allowed_from;

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error) {
      done(error);
    });

    validator.finish();
  });

  it('fails when test receipts are not allowed', function(done) {
    var testReceipt = makeReceipt(null, {
      typ: 'test-receipt',
    });
    helper.appSelf.receipts = [testReceipt];

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'TEST_RECEIPT_NOT_ALLOWED');
      assert.equal(typeof productInfo, 'object');
      done();
    });
  });

  it('accepts test receipts', function(done) {
    fxpay.configure({allowTestReceipts: true});

    var testReceipt = makeReceipt(null, {
      typ: 'test-receipt',
      iss: 'https://payments-alt.allizom.org',
      verify: 'https://payments-alt.allizom.org/developers/test-receipt/',
    });
    helper.appSelf.receipts = [testReceipt];

    var validator = new helper.ReceiptValidator({
      verifyUrl: new RegExp(
        'https://payments-alt\\.allizom\\.org/developers/test-receipt/'),
    });

    fxpay.validateAppReceipt(function(error, productInfo) {
      if (!error) {
        assert.equal(productInfo.receiptInfo.status, 'ok');
      }
      done(error);
    });

    validator.finish();
  });

  it('fails when no receipt is present', function(done) {
    helper.appSelf.receipts = [];

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'APP_RECEIPT_MISSING');
      assert.equal(typeof productInfo, 'object');
      done();
    });

    validator.finish();
  });

  it('fails when mozApps is null', function(done) {
    fxpay.configure({mozApps: null, appSelf: null});

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'PAY_PLATFORM_UNAVAILABLE');
      assert.equal(typeof productInfo, 'object');
      done();
    });

  });

  it('fails when appSelf is null', function(done) {
    fxpay.configure({appSelf: null});
    helper.appSelf.result = null;

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'PAY_PLATFORM_UNAVAILABLE');
      assert.equal(typeof productInfo, 'object');
      done();
    });

    helper.appSelf.onsuccess();
  });

  it('fails when multiple receipts are installed', function(done) {
    helper.appSelf.receipts = [makeReceipt(), makeReceipt()];

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'NOT_IMPLEMENTED_ERROR');
      assert.equal(typeof productInfo, 'object');
      done();
    });
  });

  it('fails when receipt is malformed', function(done) {
    helper.appSelf.receipts = ['^%%%$$$$garbage'];

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(error, 'APP_RECEIPT_MISSING');
      assert.equal(typeof productInfo, 'object');
      done();
    });

    validator.finish();
  });

  it('ignores in-app receipts', function(done) {
    var appId = '1234';
    var appReceipt = makeReceipt({storedata: 'id=' + appId});
    var inAppProductReceipt = makeReceipt({storedata: 'id=555&inapp_id=234'});
    helper.appSelf.receipts = [
      appReceipt,
      inAppProductReceipt,
    ];

    var validator = new helper.ReceiptValidator();

    fxpay.validateAppReceipt(function(error, productInfo) {
      assert.equal(productInfo.productId, appId);
      done(error);
    });

    validator.finish();
  });


  function makeReceipt(overrides, receiptData) {
    overrides = utils.defaults(overrides, {
      productUrl: defaultProductUrl,
      storedata: 'id=1234',
    });
    return helper.makeReceipt(receiptData, overrides);
  }
});
