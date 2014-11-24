describe('fxpay.init()', function() {

  beforeEach(function() {
    helper.setUp();
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('should call back when started', function (done) {
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

  it('should error with unknown options', function (done) {
    fxpay.init({
      onerror: function(err) {
        assert.equal(err, 'INCORRECT_USAGE');
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
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        done();
      }
    });

    helper.appSelf.onsuccess();
  });

  it('should error when not running as app', function (done) {
    fxpay.init({
      onerror: function(err) {
        assert.equal(err, 'NOT_INSTALLED_AS_APP');
        done();
      }
    });

    // This happens when you access the app from a browser
    // (i.e. not installed).
    helper.appSelf.result = null;
    helper.appSelf.onsuccess();
  });

  it('should pass through apps platform errors', function (done) {
    fxpay.init({
      onerror: function(err) {
        console.log('GOT error', err);
        assert.equal(err, 'INVALID_MANIFEST');
        done();
      }
    });

    // Simulate an apps platform error.
    helper.appSelf.error = {name: 'INVALID_MANIFEST'};
    helper.appSelf.onerror();
  });

  it('should error when apps are not supported', function (done) {
    fxpay.configure({
      mozApps: {}  // invalid mozApps.
    });
    fxpay.init({
      onerror: function(err) {
        console.log('GOT error', err);
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        done();
      }
    });
  });

  it('should error when no apps API at all', function (done) {
    fxpay.configure({
      mozApps: null  // no API, like Chrome or whatever.
    });
    fxpay.init({
      onerror: function(err) {
        console.log('GOT error', err);
        assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
        done();
      }
    });
  });

});
