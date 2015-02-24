describe('fxpay.utils.defaults()', function() {

  it('should handle merging defaults into object', function() {
    var obj = {
      bar: false,
      foo: 'something',
    };
    var defaults  = {
      bar: true,
      newKey: 'new-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: false,
      foo: 'something',
      newKey: 'new-thing',
    });
  });

  it('should handle merging defaults into empty object', function() {
    var obj = {};
    var defaults  = {
      bar: true,
      newKey: 'new-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: true,
      newKey: 'new-thing',
    });
  });

  it('should not override existing props', function() {
    var obj  = {
      bar: true,
      newKey: 'new-thing'
    };
    var defaults  = {
      bar: false,
      newKey: 'other-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: true,
      newKey: 'new-thing',
    });
  });

  it('should not override null', function() {
    var obj  = {
      bar: null,
      newKey: 'new-thing'
    };
    var defaults  = {
      bar: false,
      newKey: 'other-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: null,
      newKey: 'new-thing',
    });
  });

  it('should override an undefined property', function() {
    var obj  = {
      bar: undefined,
    };
    var defaults  = {
      bar: false,
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: false,
    });
  });

  it('should handle the object being undefined', function() {
    var defaults  = {
      bar: 'result',
    };
    var result = fxpay.utils.defaults(undefined, defaults);
    assert.deepEqual(result, {
      bar: 'result',
    });
  });
});


describe('fxpay.utils.openWindow()', function() {

  beforeEach(function(){
    this.openWindowSpy = sinon.spy();
    fxpay.configure({window: {open: this.openWindowSpy}});
  });

  it('should be called with props', function() {
    fxpay.utils.openWindow({
      url: 'http://blah.com',
      title: 'whatever',
      w: 200,
      h: 400
    });
    assert(this.openWindowSpy.calledWithMatch('http://blah.com', 'whatever'));
    assert.include(this.openWindowSpy.args[0][2], 'width=200');
    assert.include(this.openWindowSpy.args[0][2], 'height=400');
  });

  it('should be called with defaults', function() {
    fxpay.utils.openWindow();
    assert(this.openWindowSpy.calledWithMatch('', 'FxPay'));
    assert.include(this.openWindowSpy.args[0][2], 'width=276');
    assert.include(this.openWindowSpy.args[0][2], 'height=384');
  });

  it('should be passed a features string with no whitespace', function() {
    fxpay.utils.openWindow();
    assert.notInclude(this.openWindowSpy.args[0][2], ' ');
  });
});


describe('fxpay.utils.getSelfOrigin', function() {

  it('should return the app origin', function() {
    assert.equal(
      fxpay.utils.getSelfOrigin({appSelf: {origin: 'app://origin'}}),
      'app://origin');
  });

  it('should fall back to location origin', function() {
    var stubLocation = {origin: 'http://foo.com:3000'};
    assert.equal(
      fxpay.utils.getSelfOrigin({window: {location: stubLocation}}),
      'http://foo.com:3000');
  });

  it('should fall back to a derived origin', function() {
    var stubLocation = {protocol: 'http:',
                        hostname: 'foo.com:3000'};
    assert.equal(
      fxpay.utils.getSelfOrigin({window: {location: stubLocation}}),
      'http://foo.com:3000');
  });
});


describe('fxpay.utils.getUrlOrigin()', function() {

  it('returns location from URL', function() {
    assert.equal(fxpay.utils.getUrlOrigin('http://foo.com/somewhere.html'),
                 'http://foo.com');
  });

  it('returns location with port', function() {
    assert.equal(fxpay.utils.getUrlOrigin('http://foo.com:3000/somewhere.html'),
                 'http://foo.com:3000');
  });

});


describe('fxpay.utils.getAppSelf()', function() {

  beforeEach(function() {
    helper.setUp();
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('returns mozApps self', function(done) {
    fxpay.utils.getAppSelf(function(error, appSelf) {
      assert.equal(appSelf, helper.appSelf);
      done(error);
    });

    helper.appSelf.onsuccess();
  });

  it('caches and returns mozApps self', function(done) {
    fxpay.utils.getAppSelf(function() {
      // Now get the cached version:
      fxpay.utils.getAppSelf(function(error, appSelf) {
        assert.equal(appSelf, helper.appSelf);
        done(error);
      });
    });

    helper.appSelf.onsuccess();
  });

  it('returns mozApps errors', function(done) {
    fxpay.utils.getAppSelf(function(error, appSelf) {
      assert.equal(error, 'SOME_ERROR');
      assert.strictEqual(appSelf, null);
      done();
    });

    helper.appSelf.error = {name: 'SOME_ERROR'};
    helper.appSelf.onerror();
  });

  it('returns false when mozApps is falsey', function(done) {
    // This is what happens when we're running on a non-apps platform.
    fxpay.configure({mozApps: null});
    fxpay.utils.getAppSelf(function(error, appSelf) {
      assert.strictEqual(appSelf, false);
      done(error);
    });
  });

  it('returns pre-fetched appSelf', function(done) {
    fxpay.configure({appSelf: 'some-cached-value'});
    fxpay.utils.getAppSelf(function(error, appSelf) {
      assert.equal(appSelf, 'some-cached-value');
      done(error);
    });
  });

  it('returns any non-null appSelf', function(done) {
    fxpay.configure({appSelf: false});
    fxpay.utils.getAppSelf(function(error, appSelf) {
      assert.strictEqual(appSelf, false);
      done(error);
    });
  });
});
