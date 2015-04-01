define([
  'errors',
  'settings'
], function(errors, settings) {

  describe('fxpay.settings', function() {
    var adapterConfigure;
    var adapter;

    var Adapter = function() {};
    Adapter.prototype.configure = function() {};

    beforeEach(function() {
      settings.configure({}, {reset: true});
      adapter = new Adapter();
      adapterConfigure = sinon.spy(adapter, 'configure');
    });

    afterEach(function() {
      settings.configure({}, {reset: true});
    });

    it('should allow you to set an adapter', function() {
      settings.configure({adapter: adapter});
      assert.equal(adapterConfigure.called, true);
    });

    it('should reconfigure the adapter', function() {
      settings.configure({adapter: adapter});
      // The adapter should always be reconfigured.
      settings.configure();
      assert.equal(adapterConfigure.callCount, 2);
    });

    it('should let you merge in new parameters', function() {
      assert.equal(settings.allowTestReceipts, false);
      settings.configure({allowTestReceipts: true});
      assert.equal(settings.allowTestReceipts, true);
      // Configuring something else should preserve old values.
      settings.configure({apiUrlBase: 'https://mysite.net'});
      assert.equal(settings.allowTestReceipts, true);
    });

    it('should allow test receipts for fake products', function() {
      settings.configure({fakeProducts: true});
      assert.equal(settings.allowTestReceipts, true);
    });

    it('should merge in new payment providers', function() {
      var prodDefault = settings.payProviderUrls['mozilla/payments/pay/v1'];
      var newProviders = {
        'mysite/pay/v1': 'https://mysite.net/pay/?req={jwt}',
      };
      settings.configure({extraProviderUrls: newProviders});
      assert.equal(settings.payProviderUrls['mozilla/payments/pay/v1'],
                   prodDefault);
      assert.equal(settings.payProviderUrls['mysite/pay/v1'],
                   newProviders['mysite/pay/v1']);
    });

    it('should let you initialize settings with values', function() {
      settings.initialize({allowTestReceipts: true});
      assert.equal(settings.allowTestReceipts, true);
    });

    it('should only initialize settings once', function() {
      settings.alreadyConfigured = false;
      settings.initialize();

      var defaultConfigure = sinon.spy(settings.adapter, 'configure');

      settings.initialize();
      settings.initialize();

      // Make sure repeated calls do not re-configure.
      assert.equal(defaultConfigure.callCount, 0);
    });

    it('does not re-initialize settings with null parameters', function() {
      settings.alreadyConfigured = false;
      settings.initialize();

      var defaultConfigure = sinon.spy(settings.adapter, 'configure');

      settings.initialize(null);

      // Make sure repeated calls do not re-configure.
      assert.equal(defaultConfigure.callCount, 0);
    });

    it('should only allow you to re-initialize settings', function() {
      var defaultConfigure = sinon.spy(settings.adapter, 'configure');

      settings.initialize({allowTestReceipts: true});
      settings.initialize({allowTestReceipts: true});

      // Since we passed in new settings, each call should reconfigure.
      assert.equal(defaultConfigure.callCount, 2);
    });

    it('initializes settings with defaults on first run', function() {
      var nonDefaultValue = 'not-a-default-value';
      settings.allowTestReceipts = nonDefaultValue;

      settings.alreadyConfigured = false;
      settings.initialize();

      // This ensures that the first run resets all settings.
      assert.ok(settings.allowTestReceipts !== nonDefaultValue);
    });

    it('initializes settings with defaults even with overrides', function() {
      var nonDefaultValue = 'not-a-default-value';
      settings.allowTestReceipts = nonDefaultValue;

      settings.alreadyConfigured = false;
      settings.initialize({log: console});

      // This ensures that the first run resets all settings even
      // if the first initialize call overrode some values.
      assert.ok(settings.allowTestReceipts !== nonDefaultValue);
    });

    it('should error with unknown options', function () {
      assert.throws(function() {
        settings.configure({notAvalidOption: false});
      }, errors.IncorrectUsage);
    });

  });
});
