define([
  'errors',
  'fxpay',
  'helper',
  'products',
  'receipts'
], function(errors, fxpay, helper, products, receipts) {

  describe('receipts.verifyInAppProductData()', function() {
    var someProduct = new products.Product({productId: 'some-uuid'});
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
      receipts.verifyInAppProductData({}, someProduct, function(err) {
        assert.instanceOf(err, errors.InvalidReceipt);
        done();
      });
    });

    it('fails on corrupted storedata', function(done) {
      receipts.verifyInAppProductData(
          makeReceipt({storedata: 'not%a!valid(string'}),
          someProduct,
          function(err) {
        assert.instanceOf(err, errors.InvalidReceipt);
        assert.equal(err.productInfo.productId, someProduct.productId);
        done();
      });
    });

    it('handles malformed storedata', function(done) {
      receipts.verifyInAppProductData(makeReceipt({storedata: '&&&'}),
                                            someProduct,
                                            function(err) {
        assert.instanceOf(err, errors.InvalidReceipt);
        assert.equal(err.productInfo.productId, someProduct.productId);
        done();
      });
    });

    it('fails on missing storedata', function(done) {
      receipts.verifyInAppProductData(
          makeReceipt({storedata: 'foo=baz&barz=zonk'}),
          someProduct,
          function(err) {
        assert.instanceOf(err, errors.InvalidReceipt);
        assert.equal(err.productInfo.productId, someProduct.productId);
        done();
      });
    });

    it('passes through receipt data', function(done) {
      var productId = 'receipt-product-guid';
      var productUrl = 'app://some-packaged-origin';
      var storedata = 'inapp_id=' + productId;
      helper.appSelf.origin = productUrl;

      receipts.verifyInAppProductData(
          makeReceipt({storedata: storedata,
                       productUrl: productUrl}),
          someProduct,
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
});
