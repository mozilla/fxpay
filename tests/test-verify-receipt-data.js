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

  it('fails on missing product', function(done) {
    fxpay.receipts.verifyData({}, function(err) {
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

  it('fails on corrupted storedata', function(done) {
    fxpay.receipts.verifyData(receipt({storedata: 'not%a!valid(string'}),
                              function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('handles malformed storedata', function(done) {
    fxpay.receipts.verifyData(receipt({storedata: '&&&'}),
                              function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on missing storedata', function(done) {
    fxpay.receipts.verifyData(receipt({storedata: 'foo=baz&barz=zonk'}),
                              function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on foreign product URL', function(done) {
    var data = receipt({productUrl: 'wrong-app'});
    fxpay.receipts.verifyData(data, function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
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

  it('allows foreign app receipts with a setting', function(done) {
    fxpay.configure({
      allowAnyAppReceipt: true
    });
    var data = receipt({productUrl: 'wrong-app'});
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

  it('passes through receipt data', function(done) {
    var productId = 'some-guid';
    var productUrl = 'app://some-packaged-origin';
    var storedata = 'inapp_id=' + productId;
    helper.appSelf.origin = productUrl;

    fxpay.receipts.verifyData(receipt({storedata: storedata,
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
