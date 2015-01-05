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

  it('should start up without mozApps', function (done) {
    var fakeWindow = {location: {href: 'http://some-site.com'}};

    fxpay.configure({
      mozApps: null,
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

  it('should error for undefined origin', function (done) {
    var fakeWindow = {location: {href: 'app://xxxxxx'}};

    fxpay.configure({
      window: fakeWindow,
    });

    fxpay.init({
      onerror: function(err) {
        assert.equal(err, 'UNDEFINED_APP_ORIGIN');
        done();
      },
    });

    helper.appSelf.manifest = {};  // undefined origin
    helper.appSelf.onsuccess();
  });

  it('should allow packaged apps with an origin', function (done) {
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

    helper.appSelf.manifest = {origin: 'app://some-origin'};
    helper.appSelf.onsuccess();
  });

});
