describe('fxpay.receipts.verifyAppData()', function() {
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

  it('fails on missing storedata', function(done) {
    fxpay.receipts.verifyAppData(
        makeReceipt({storedata: 'foo=baz&barz=zonk'}),
        function(err) {
      assert.instanceOf(err, fxpay.errors.InvalidReceipt);
      done();
    });
  });

  it('passes through receipt data', function(done) {
    var productId = '123';
    var productUrl = 'app://some-packaged-origin';
    var storedata = 'id=' + productId;
    helper.appSelf.origin = productUrl;

    fxpay.receipts.verifyAppData(
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
