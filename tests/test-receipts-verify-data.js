describe('fxpay.receipts.verifyData()', function() {
  var receiptCheckSite = 'https://niceverifier.org';

  beforeEach(function() {
    helper.setUp();
    fxpay.configure({
      appSelf: helper.appSelf,
      receiptCheckSites: [receiptCheckSite]
    });
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('fails on non-strings', function(done) {
    fxpay.receipts.verifyData({not: 'a receipt'}, function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on too many key segments', function(done) {
    fxpay.receipts.verifyData('one~too~many', function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on not enough JWT segments', function(done) {
    fxpay.receipts.verifyData('one.two', function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on invalid base64 encoding', function(done) {
    fxpay.receipts.verifyData(receipt({receipt: 'not%valid&&base64'}),
                              function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on invalid JSON', function(done) {
    fxpay.receipts.verifyData('jwtAlgo.' + btoa('^not valid JSON') + '.jwtSig',
                              function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on missing product URL', function(done) {
    fxpay.receipts.verifyData(receipt(null, {
      product: {
        storedata: 'storedata'
      }
    }), function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on missing storedata', function(done) {
    fxpay.receipts.verifyData(
        'jwtAlgo.' + btoa(JSON.stringify({product: {}})) + '.jwtSig',
        function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on non-string storedata', function(done) {
    fxpay.receipts.verifyData(receipt({storedata: {}}),
                              function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on foreign product URL for packaged app', function(done) {
    var data = receipt({productUrl: 'wrong-app'});
    fxpay.receipts.verifyData(data, function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on foreign product URL for hosted app', function(done) {
    var webOrigin = 'http://some-site.com';

    fxpay.configure({
      window: {location: {origin: webOrigin}},
      appSelf: null,
    });

    var data = receipt({productUrl: 'http://wrong-site.com'});
    fxpay.receipts.verifyData(data, function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('knows how to validate hosted app product URLs', function(done) {
    var webOrigin = 'http://some-site.com';

    fxpay.configure({
      window: {location: {origin: webOrigin}},
      appSelf: null,
    });

    var data = receipt({productUrl: webOrigin});
    fxpay.receipts.verifyData(data, function(err) {
      done(err);
    });
  });

  it('handles non-prefixed app origins', function(done) {
    helper.appSelf.origin = 'app://the-origin';
    // TODO: remove this when fixed in Marketplace. bug 1034264.
    var data = receipt({productUrl: 'the-origin'});

    fxpay.receipts.verifyData(data, function(err) {
      done(err);
    });
  });

  it('handles properly prefixed app origins', function(done) {
    helper.appSelf.origin = 'app://the-app';
    var data = receipt({productUrl: helper.appSelf.origin});

    fxpay.receipts.verifyData(data, function(err) {
      done(err);
    });
  });

  it('handles HTTP hosted app origins', function(done) {
    helper.appSelf.origin = 'http://hosted-app';
    var data = receipt({productUrl: helper.appSelf.origin});

    fxpay.receipts.verifyData(data, function(err) {
      done(err);
    });
  });

  it('handles HTTPS hosted app origins', function(done) {
    helper.appSelf.origin = 'https://hosted-app';
    var data = receipt({productUrl: helper.appSelf.origin});

    fxpay.receipts.verifyData(data, function(err) {
      done(err);
    });
  });

  it('allows wrong product URLs for test receipts', function(done) {
    // Only allow test receipts when fakeProducts is true.
    fxpay.configure({fakeProducts: true});
    fxpay.receipts.verifyData(receipt({productUrl: 'wrong-app'},
                                      {typ: 'test-receipt'}),
                              function(err) {
      done(err);
    });
  });

  it('fails on disallowed receipt check URLs', function(done) {
    fxpay.receipts.verifyData(receipt(null,
                                      {verify: 'http://mykracksite.ru'}),
                              function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('disallows test receipts when not testing', function(done) {
    fxpay.receipts.verifyData(receipt(null, {typ: 'test-receipt'}),
                              function(err, info) {
      assert.equal(err, 'TEST_RECEIPT_NOT_ALLOWED');
      assert.equal(typeof info, 'object');
      done();
    });
  });


  function receipt(overrides, receiptData) {
    overrides = overrides || {};
    receiptData = receiptData || {};

    receiptData.verify = (receiptData.verify ||
                          receiptCheckSite + '/verify/');
    overrides.productUrl = overrides.productUrl || helper.someAppOrigin;

    return helper.makeReceipt(receiptData, overrides);
  }

});
