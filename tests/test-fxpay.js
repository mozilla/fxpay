define([
  'errors',
  'fxpay',
  'helper',
  'settings',
], function(errorsModule, fxpay, helper, settingsModule) {

  describe('fxpay', function() {

    beforeEach(function() {
      helper.setUp();
    });

    afterEach(function() {
      helper.tearDown();
    });

    it('should expose fxpay.errors', function() {
      assert.equal(fxpay.errors.FxPayError, errorsModule.FxPayError);
    });

    it('should expose fxpay.settings', function() {
      assert.equal(fxpay.settings.fakeProducts, settingsModule.fakeProducts);
    });

  });
});
