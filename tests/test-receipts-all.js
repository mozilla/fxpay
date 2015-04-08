define([
  'errors',
  'fxpay',
  'helper',
  'receipts',
  'settings'
], function(errors, fxpay, helper, receipts, settings) {

  describe('receipts.all()', function() {

    beforeEach(function() {
      helper.setUp();
    });

    afterEach(function() {
      helper.tearDown();
    });

    it('exposes mozApps receipts', function(done) {
      var receipt = '<receipt>';
      fxpay.configure({
        appSelf: {
          receipts: [receipt]
        }
      });
      receipts.all(function(error, fetchedReceipts) {
        if (!error) {
          assert.equal(fetchedReceipts[0], receipt);
          assert.equal(fetchedReceipts.length, 1);
        }
        done(error);
      });
    });

    it('ignores missing receipts', function(done) {
      fxpay.configure({appSelf: {}});  // no receipts property
      receipts.all(function(error, fetchedReceipts) {
        if (!error) {
          assert.equal(fetchedReceipts.length, 0);
        }
        done(error);
      });
    });

    it('gets mozApps receipts and localStorage ones', function(done) {
      var receipt1 = '<receipt1>';
      var receipt2 = '<receipt2>';

      fxpay.configure({
        appSelf: {
          receipts: [receipt1]
        }
      });
      window.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify([receipt2]));

      receipts.all(function(error, fetchedReceipts) {
        if (!error) {
          assert.equal(fetchedReceipts[0], receipt1);
          assert.equal(fetchedReceipts[1], receipt2);
          assert.equal(fetchedReceipts.length, 2);
        }
        done(error);
      });
    });

    it('filters out dupe receipts', function(done) {
      var receipt1 = '<receipt1>';

      fxpay.configure({
        appSelf: {
          receipts: [receipt1]
        }
      });
      window.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify([receipt1]));

      receipts.all(function(error, fetchedReceipts) {
        if (!error) {
          assert.equal(fetchedReceipts[0], receipt1);
          assert.equal(fetchedReceipts.length, 1);
        }
        done(error);
      });
    });

    it('handles appSelf errors', function(done) {
      helper.appSelf.error = {name: 'INVALID_MANIFEST'};
      fxpay.configure({
        appSelf: null  // clear appSelf cache.
      });
      receipts.all(function(error) {
        assert.instanceOf(error, errors.InvalidApp,
                          'should be instanceOf errors.InvalidApp');
        assert.equal(error.code, 'INVALID_MANIFEST');
        done();
      });

      helper.appSelf.onerror();
    });

  });
});
