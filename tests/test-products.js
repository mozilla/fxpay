describe('fxpay.products.Product', function() {
  var Product = fxpay.getattr('products').Product;
  var product = new Product({productId: 'some-id'});

  beforeEach(function() {
    helper.setUp();
    fxpay.configure({
      appSelf: helper.appSelf,
    });
  });

  afterEach(function() {
    helper.tearDown();
  });

  describe('hasReceipt()', function() {

    it('returns false when no receipts', function() {
      fxpay.configure({productReceiptMap: {}});
      assert.equal(product.hasReceipt(), false);
    });

    it('returns true when receipt exists', function() {
      var productReceiptMap = {};
      productReceiptMap[product.productId] = helper.makeReceipt();
      fxpay.configure({productReceiptMap: productReceiptMap});

      assert.equal(product.hasReceipt(), true);
    });

    it('requires re-population of receipt map', function() {
      fxpay.configure({productReceiptMap: null});
      assert.throws(function() {
        product.hasReceipt();
      }, fxpay.errors.IncorrectUsage);
    });

  });

});
