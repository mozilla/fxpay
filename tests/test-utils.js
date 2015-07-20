define([
  'errors',
  'fxpay',
  'helper',
  'utils',
], function(errors, fxpay, helper, utils) {

  describe('utils.defaults()', function() {

    it('should handle merging defaults into object', function() {
      var obj = {
        bar: false,
        foo: 'something',
      };
      var defaults  = {
        bar: true,
        newKey: 'new-thing'
      };
      var result = utils.defaults(obj, defaults);
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
      var result = utils.defaults(obj, defaults);
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
      var result = utils.defaults(obj, defaults);
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
      var result = utils.defaults(obj, defaults);
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
      var result = utils.defaults(obj, defaults);
      assert.deepEqual(result, {
        bar: false,
      });
    });

    it('should handle the object being undefined', function() {
      var defaults  = {
        bar: 'result',
      };
      var result = utils.defaults(undefined, defaults);
      assert.deepEqual(result, {
        bar: 'result',
      });
    });
  });


  describe('utils.openWindow()', function() {

    beforeEach(function(){
      this.openWindowSpy = sinon.spy();
      fxpay.configure({window: {open: this.openWindowSpy}});
    });

    it('should be called with props', function() {
      utils.openWindow({
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
      utils.openWindow();
      assert(this.openWindowSpy.calledWithMatch('', 'FxPay'));
      assert.include(this.openWindowSpy.args[0][2], 'width=276');
      assert.include(this.openWindowSpy.args[0][2], 'height=384');
    });

    it('should be passed a features string with no whitespace', function() {
      utils.openWindow();
      assert.notInclude(this.openWindowSpy.args[0][2], ' ');
    });
  });


  describe('utils.getSelfOrigin', function() {

    it('should return the app origin', function() {
      assert.equal(
        utils.getSelfOrigin({
          appSelf: {
            origin: 'app://origin',
            manifest: {
              origin: 'app://origin',
              type: 'privileged',
            },
          },
        }),
        'app://origin');
    });

    it('should return the marketplace GUID origin', function() {
      assert.equal(
        utils.getSelfOrigin({
          log: {info: function() {}},
          appSelf: {
            origin: 'app://unusable-origin',
            manifest: {
              type: 'web',
            },
            manifestURL: ('https://marketplace-dev.allizom.org' +
                          '/app/some-guid/manifest.webapp'),
          },
        }),
        'marketplace:some-guid');
    });

    it('should fall back to marketplace when no declared origin', function() {
      assert.equal(
        utils.getSelfOrigin({
          log: {info: function() {}},
          // Set up a privileged app that has not declared an origin.
          appSelf: {
            origin: 'app://unusable-origin',
            manifest: {
              type: 'privileged',
              origin: null,
            },
            manifestURL: ('https://marketplace-dev.allizom.org' +
                          '/app/some-guid/manifest.webapp'),
          },
        }),
        'marketplace:some-guid');
    });

    it('should error on non-marketplace packages', function() {
      assert.throws(function() {
        utils.getSelfOrigin({
          appSelf: {
            // This would be a randomly generated origin by the platform.
            origin: 'app://unusable-origin',
            manifest: {
              type: 'web',
              origin: null,
            },
            manifestURL: 'http://some-random-site/f/manifest.webapp',
          },
        });
      }, errors.InvalidAppOrigin);
    });

    it('should fall back to location origin', function() {
      var stubLocation = {origin: 'http://foo.com:3000'};
      assert.equal(
        utils.getSelfOrigin({window: {location: stubLocation}}),
        'http://foo.com:3000');
    });

    it('should fall back to a derived origin', function() {
      var stubLocation = {protocol: 'http:',
                          hostname: 'foo.com:3000'};
      assert.equal(
        utils.getSelfOrigin({window: {location: stubLocation}}),
        'http://foo.com:3000');
    });

  });


  describe('utils.getUrlOrigin()', function() {

    it('returns location from URL', function() {
      assert.equal(utils.getUrlOrigin('http://foo.com/somewhere.html'),
                   'http://foo.com');
    });

    it('returns location with port', function() {
      assert.equal(utils.getUrlOrigin('http://foo.com:3000/somewhere.html'),
                   'http://foo.com:3000');
    });

  });

  describe('utils.serialize()', function() {

    it('should serialize object', function() {
      assert.equal(utils.serialize({foo: 'bar', baz: 'zup'}),
                   'foo=bar&baz=zup');
    });

    it('should urlencode keys + values', function() {
      assert.equal(
        utils.serialize({'album name': 'Back in Black', 'artist': 'AC/DC'}),
        'album%20name=Back%20in%20Black&artist=AC%2FDC');
    });

  });

  describe('utils.getAppSelf()', function() {

    beforeEach(function() {
      helper.setUp();
    });

    afterEach(function() {
      helper.tearDown();
    });

    it('returns mozApps self', function(done) {
      utils.getAppSelf(function(error, appSelf) {
        assert.equal(appSelf, helper.appSelf);
        done(error);
      });

      helper.appSelf.onsuccess();
    });

    it('caches and returns mozApps self', function(done) {
      utils.getAppSelf(function() {
        // Now get the cached version:
        utils.getAppSelf(function(error, appSelf) {
          assert.equal(appSelf, helper.appSelf);
          done(error);
        });
      });

      helper.appSelf.onsuccess();
    });

    it('returns mozApps errors', function(done) {
      utils.getAppSelf(function(error, appSelf) {
        assert.instanceOf(error, errors.InvalidApp);
        assert.equal(error.code, 'SOME_ERROR');
        assert.strictEqual(appSelf, null);
        done();
      });

      helper.appSelf.error = {name: 'SOME_ERROR'};
      helper.appSelf.onerror();
    });

    it('returns false when mozApps is falsey', function(done) {
      // This is what happens when we're running on a non-apps platform.
      fxpay.configure({mozApps: null});
      utils.getAppSelf(function(error, appSelf) {
        assert.strictEqual(appSelf, false);
        done(error);
      });
    });

    it('returns pre-fetched appSelf', function(done) {
      fxpay.configure({appSelf: 'some-cached-value'});
      utils.getAppSelf(function(error, appSelf) {
        assert.equal(appSelf, 'some-cached-value');
        done(error);
      });
    });

    it('returns any non-null appSelf', function(done) {
      fxpay.configure({appSelf: false});
      utils.getAppSelf(function(error, appSelf) {
        assert.strictEqual(appSelf, false);
        done(error);
      });
    });
  });

});
