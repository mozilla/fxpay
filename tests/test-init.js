describe('fxpay.init()', function() {

  beforeEach(function() {
    helper.setUp();
    fxpay.configure({appSelf: helper.appSelf});
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('should call back when started', function (done) {
    fxpay.configure({
      appSelf: null,
    });

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {
        done();
      }
    });

    helper.appSelf.onsuccess();
  });

  it('should start up without mozApps', function (done) {
    var fakeWindow = {location: {href: 'http://some-site.com'}};

    fxpay.configure({
      mozApps: null,
      appSelf: null,
      window: fakeWindow,
    });
    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {
        done();
      }
    });
  });

  it('should error with unknown options', function (done) {
    fxpay.init({
      onerror: function(err) {
        assert.instanceOf(err, fxpay.errors.IncorrectUsage);
        done();
      },
      oninit: function() {
        done('init should not have been called');
      },
      notAvalidOption: false
    });
  });

  it('should error when receipt storage does not exist', function (done) {
    delete helper.appSelf.addReceipt;  // older FxOSs do not have this.

    fxpay.configure({
      localStorage: null  // no fallback.
    });

    fxpay.init({
      onerror: function(err) {
        assert.instanceOf(err, fxpay.errors.PayPlatformUnavailable);
        done();
      }
    });
  });

  it('should pass through apps platform errors', function (done) {
    fxpay.configure({appSelf: null});

    fxpay.init({
      onerror: function(err) {
        assert.instanceOf(err, fxpay.errors.InvalidApp);
        assert.equal(err.code, 'INVALID_MANIFEST');
        done();
      }
    });

    // Simulate an apps platform error.
    helper.appSelf.error = {name: 'INVALID_MANIFEST'};
    helper.appSelf.onerror();
  });

  it('should error for undefined origin', function (done) {
    helper.appSelf.manifest = {};  // undefined origin
    var fakeWindow = {location: {href: 'app://xxxxxx'}};

    fxpay.configure({
      window: fakeWindow,
    });

    fxpay.init({
      onerror: function(err) {
        assert.instanceOf(err, fxpay.errors.InvalidApp);
        done();
      },
    });
  });

  it('should allow packaged apps with an origin', function (done) {
    helper.appSelf.manifest = {origin: 'app://some-origin'};
    var fakeWindow = {location: {href: 'app://some-origin'}};

    fxpay.configure({
      window: fakeWindow,
    });

    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {
        done();
      },
    });
  });

  it('should let you append extra provider URLs', function (done) {
    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {
        assert.equal(fxpay.settings.payProviderUrls['random/value'],
                     'http://somewhere.net/?req={jwt}');
        done();
      },
      extraProviderUrls: {
        'random/value': 'http://somewhere.net/?req={jwt}',
      },
    });
  });

  it('should let you overwrite provider URLs', function (done) {
    fxpay.init({
      onerror: function(err) {
        done(err);
      },
      oninit: function() {
        assert.equal(
          fxpay.settings.payProviderUrls['mozilla/payments/pay/v1'],
          'http://somewhere.net/?req={jwt}');
        done();
      },
      extraProviderUrls: {
        // Overwrite the production URL.
        'mozilla/payments/pay/v1': 'http://somewhere.net/?req={jwt}',
      },
    });
  });

});
