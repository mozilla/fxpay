define([
  'errors',
  'fxpay',
  'helper',
], function(errors, fxpay, helper) {

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

      fxpay.purchase(productId).then(function() {
        done();
      }).catch(done);

      helper.resolvePurchase({
        mozPay: mozPay,
        mozPayResolver: function(domRequest) {
          domRequest.error = {name: 'USER_CANCELLED'};
          domRequest.onerror();
        },
      });

    });

    it('should pass through non-cancel errors', function(done) {

      fxpay.purchase(productId).then(function() {
        done(Error('unexpected success'));
      }).catch(function(err) {
        assert.instanceOf(err, errors.PayPlatformError);
        assert.equal(err.code, 'SOME_RANDOM_ERROR');
        done();
      }).catch(done);

      helper.resolvePurchase({
        mozPay: mozPay,
        mozPayResolver: function(domRequest) {
          domRequest.error = {name: 'SOME_RANDOM_ERROR'};
          domRequest.onerror();
        },
      });

    });

  });
});
