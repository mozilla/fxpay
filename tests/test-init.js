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
    fxpay.configure({
      mozApps: null
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

});
