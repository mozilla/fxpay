define([
  'errors',
  'fxpay',
  'helper',
  'pay',
  'settings',
  'utils',
], function(errors, fxpay, helper, pay, settings, utils) {

  describe('fxpay.purchase() on the web', function() {
    var payReq = {typ: 'mozilla/payments/pay/v1'};
    var fakeJwt = '<algo>.' + btoa(JSON.stringify(payReq)) + '.<sig>';
    var productId = 'some-uuid';

    var providerUrlTemplate;
    var fakePayWindow;
    var windowSpy;
    var customPayWindow;
    var customWindowSpy;
    var handlers;
    var clock;

    beforeEach(function() {
      helper.setUp();
      handlers = {};
      fakePayWindow = {
        closed: false,
        close: function() {},
      };
      windowSpy = {
        close: sinon.spy(fakePayWindow, 'close'),
      };
      customPayWindow = {
        close: function() {},
        resizeTo: function() {},
        moveTo: function() {},
      };
      customWindowSpy = {
        close: sinon.spy(customPayWindow, 'close'),
        resizeTo: sinon.spy(customPayWindow, 'resizeTo'),
        moveTo: sinon.spy(customPayWindow, 'moveTo'),
      };
      providerUrlTemplate = helper.settings.payProviderUrls[payReq.typ];


      fxpay.configure({
        appSelf: null,
        mozApps: null,
        mozPay: null,
        apiUrlBase: 'https://not-the-real-marketplace',
        apiVersionPrefix: '/api/v1',
        adapter: null,
        window: {
          location: '',
          open: function() {
            return fakePayWindow;
          },
          addEventListener: function(type, handler) {
            handlers[type] = handler;
          },
          removeEventListener: function() {},
        },
      });

      clock = sinon.useFakeTimers();
      // Must be after fakeTimers are setup.
      sinon.spy(window, 'clearInterval');
    });

    afterEach(function() {
      helper.tearDown();
      helper.receiptAdd.reset();
      // Must be before clock.restare().
      window.clearInterval.restore();
      clock.restore();
    });

    it('should open a payment window and resolve', function (done) {

      fxpay.purchase(productId).then(function() {
        assert.equal(
          fakePayWindow.location,
          providerUrlTemplate.replace('{jwt}', fakeJwt));
        assert(windowSpy.close.called);
        done();
      }).catch(done);

      helper.resolvePurchase({
        productData: {webpayJWT: fakeJwt},
        payCompleter: function() {
          simulatePostMessage({status: 'ok'});
        }
      });
    });

    it('should reject with payment errors', function (done) {

      fxpay.purchase(productId).then(function() {
        done(Error('unexpected success'));
      }).catch(function(err) {
        assert.instanceOf(err, errors.FailedWindowMessage);
        assert.equal(err.code, 'DIALOG_CLOSED_BY_USER');
        assert(windowSpy.close.called);
        done();
      }).catch(done);

      helper.resolvePurchase({
        productData: {webpayJWT: fakeJwt},
        payCompleter: function() {
          simulatePostMessage({status: 'failed',
                               errorCode: 'DIALOG_CLOSED_BY_USER'});
        }
      });
    });

    it('should allow client to specify a custom window', function (done) {

      fxpay.purchase(productId, {
        paymentWindow: customPayWindow,
        managePaymentWindow: true,
      }).then(function() {
        assert.equal(
          customPayWindow.location,
          providerUrlTemplate.replace('{jwt}', fakeJwt));
        assert(customWindowSpy.resizeTo.called);
        assert(customWindowSpy.moveTo.called);
        assert(customWindowSpy.close.called);
        done();
      }).catch(done);

      helper.resolvePurchase({
        productData: {webpayJWT: fakeJwt},
        payCompleter: function() {
          simulatePostMessage({status: 'ok'});
        }
      });
    });

    it('should not manage custom pay windows by default', function (done) {

      fxpay.purchase(productId, {
        paymentWindow: customPayWindow,
      }).then(function() {
        assert.equal(
          customPayWindow.location,
          providerUrlTemplate.replace('{jwt}', fakeJwt));
        assert(!customWindowSpy.close.called);
        done();
      }).catch(done);

      helper.resolvePurchase({
        productData: {webpayJWT: fakeJwt},
        payCompleter: function() {
          simulatePostMessage({status: 'ok'});
        }
      });
    });

    it('should close payment window on adapter errors', function (done) {
      settings.adapter.startTransaction = function(opt, callback) {
        callback('SOME_EARLY_ERROR');
      };

      fxpay.purchase(productId).then(function() {
        done(Error('unexpected success'));
      }).catch(function(err) {
        assert.equal(err, 'SOME_EARLY_ERROR');
        assert(windowSpy.close.called);
        done();
      }).catch(done);

    });

    it('should not close managed window on adapter errors', function (done) {
      settings.adapter.startTransaction = function(opt, callback) {
        callback('SOME_EARLY_ERROR');
      };

      fxpay.purchase(productId, {
        paymentWindow: customPayWindow,
      }).then(function() {
        done(Error('unexpected success'));
      }).catch(function(err) {
        assert.equal(err, 'SOME_EARLY_ERROR');
        assert(!customWindowSpy.close.called);
        done();
      }).catch(done);

    });

    it('should close payment window on pay module errors', function (done) {

      fxpay.purchase(productId).then(function() {
        done(Error('unexpected success'));
      }).catch(function(err) {
        assert.instanceOf(err, errors.InvalidJwt);
        assert(windowSpy.close.called);
        done();
      }).catch(done);

      // Force an unexpected JWT type error.
      var req = {typ: 'unknown/provider/id'};
      var badJwt = '<algo>.' + btoa(JSON.stringify(req)) + '.<sig>';

      helper.resolvePurchase({
        productData: {webpayJWT: badJwt},
        payCompleter: function() {},
      });
    });

    it('should respond to user closed window', function (done) {

      fxpay.purchase(productId).then(function() {
        done(Error('unexpected success'));
      }).catch(function(err) {
        assert(window.clearInterval.called, 'clearInterval should be called');
        assert.instanceOf(err, errors.PayWindowClosedByUser);
        assert.equal(err.code, 'DIALOG_CLOSED_BY_USER');
        done();
      }).catch(done);

      // Respond to fetching the JWT.
      helper.server.respondWith('POST', /.*\/webpay\/inapp\/prepare/,
                                helper.productData({webpayJWT: fakeJwt}));
      helper.server.respond();

      fakePayWindow.closed = true;
      clock.tick(600);

    });


    function simulatePostMessage(data) {
      handlers.message({data: data,
                        origin: utils.getUrlOrigin(providerUrlTemplate)});
    }

  });


  describe('pay.processPayment()', function() {

    it('should reject calls without a paymentWindow', function(done) {
      fxpay.configure({mozPay: false});
      pay.processPayment('<jwt>', function(error) {
        assert.instanceOf(error, errors.IncorrectUsage);
        done();
      });
    });

  });


  describe('pay.acceptPayMessage()', function() {
    var defaultOrigin = 'http://marketplace.firefox.com';
    var fakeWindow;
    var clock;

    beforeEach(function() {
      fakeWindow = {};
      clock = sinon.useFakeTimers();
    });

    afterEach(function() {
      clock.restore();
    });

    it('calls back on success', function(done) {
      pay.acceptPayMessage(
        makeEvent(), defaultOrigin,
        fakeWindow, function(err) {
          done(err);
        }
      );
    });

    it('calls back with error code on failure', function(done) {
      pay.acceptPayMessage(
        makeEvent({status: 'failed', errorCode: 'EXTERNAL_CODE'}),
        defaultOrigin, fakeWindow, function(err) {
          assert.instanceOf(err, errors.FailedWindowMessage);
          assert.equal(err.code, 'EXTERNAL_CODE');
          done();
        }
      );
    });

    it('rejects unknown statuses', function(done) {
      pay.acceptPayMessage(
        makeEvent({status: 'cheezborger'}),
        defaultOrigin, fakeWindow, function(err) {
          assert.instanceOf(err, errors.FailedWindowMessage);
          done();
        }
      );
    });

    it('rejects undefined data', function(done) {
      pay.acceptPayMessage(
        makeEvent({data: null}), defaultOrigin,
        fakeWindow, function(err) {
          assert.instanceOf(err, errors.FailedWindowMessage);
          done();
        }
      );
    });

    it('rejects foreign messages', function(done) {
      pay.acceptPayMessage(
        makeEvent({origin: 'http://bar.com'}), 'http://foo.com', fakeWindow,
        function(err) {
          assert.instanceOf(err, errors.UnknownMessageOrigin);
          done();
        }
      );
    });

    it('had window closed by user via an unload event', function(done) {
      fakeWindow.closed = true;
      pay.acceptPayMessage(
        makeEvent({status: 'unloaded'}),
        defaultOrigin, fakeWindow, function(err) {
          assert.instanceOf(err, errors.PayWindowClosedByUser);
          assert.equal(err.code, 'DIALOG_CLOSED_BY_USER');
          done();
        }
      );
      clock.tick(300);
    });

    function makeEvent(param) {
      param = utils.defaults(param, {
        status: 'ok',
        data: undefined,
        errorCode: undefined,
        origin: defaultOrigin,
      });
      if (typeof param.data === 'undefined') {
        param.data = {status: param.status, errorCode: param.errorCode};
      }
      return {origin: param.origin, data: param.data};
    }

  });
});
