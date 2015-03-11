describe('fxpay.purchase() on broken webRT', function () {
  var productId = 'some-uuid';
  var mozPay;

  beforeEach(function() {
    helper.setUp();
    mozPay = sinon.spy(helper.mozPayStub);
    fxpay.configure({
      appSelf: helper.appSelf,
      onBrokenWebRT: true,
      mozPay: mozPay,
    });
  });

  afterEach(function() {
    helper.tearDown();
    mozPay.reset();
    helper.receiptAdd.reset();
  });

  it('should pretend a cancel is a success', function(done) {
    fxpay.purchase(productId, function(err) {
      done(err);
    });

    var apiHelper = new ApiHelper();
    apiHelper.repondWithJWT();

    var domReq = mozPay.returnValues[0];
    domReq.error = {name: 'USER_CANCELLED'};
    domReq.onerror();

    apiHelper.finish();
  });

  it('should pass through non-cancel errors', function(done) {
    fxpay.purchase(productId, function(err) {
      assert.instanceOf(err, fxpay.errors.PayPlatformError);
      assert.equal(err.code, 'SOME_RANDOM_ERROR');
      done();
    });

    var apiHelper = new ApiHelper();
    apiHelper.repondWithJWT();

    var domReq = mozPay.returnValues[0];
    domReq.error = {name: 'SOME_RANDOM_ERROR'};
    domReq.onerror();

    apiHelper.finish();
  });


  function ApiHelper() {}

  ApiHelper.prototype.repondWithJWT = function() {
    helper.server.respondWith('POST', /.*webpay\/inapp\/prepare/,
                              helper.productData());
    helper.server.respond();
  };

  ApiHelper.prototype.finish = function() {

    // Respond with a completed transaction.
    helper.server.respondWith('GET', /http.*\/transaction\/XYZ/,
                              helper.transactionData());
    helper.server.respond();

    // Resolve the request to add a receipt.
    helper.receiptAdd.onsuccess();

    // Respond with details about the purchased product.
    helper.server.respondWith('GET', new RegExp('.*/payments/.*/in-app/.*'),
                              [200, {"Content-Type": "application/json"},
                               JSON.stringify(helper.apiProduct)]);
    helper.server.respond();
  };

});
