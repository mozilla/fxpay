describe('fxpay.receipts.verifyInAppProductData()', function() {
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

  it('fails on missing product', function(done) {
    fxpay.receipts.verifyInAppProductData({}, function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on corrupted storedata', function(done) {
    fxpay.receipts.verifyInAppProductData(
        makeReceipt({storedata: 'not%a!valid(string'}),
        function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('handles malformed storedata', function(done) {
    fxpay.receipts.verifyInAppProductData(makeReceipt({storedata: '&&&'}),
                                          function(err) {
      assert.equal(err, 'INVALID_RECEIPT');
      done();
    });
  });

  it('fails on missing storedata', function(done) {
    fxpay.receipts.verifyInAppProductData(
        makeReceipt({storedata: 'foo=baz&barz=zonk'}),
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

    fxpay.receipts.verifyInAppProductData(
        makeReceipt({storedata: storedata,
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


  function makeReceipt(overrides, receiptData) {
    receiptData = receiptData || {};
    receiptData.verify = receiptCheckSite + '/verify/';

    return helper.makeReceipt(receiptData, overrides);
  }

});
