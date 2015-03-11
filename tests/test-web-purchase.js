describe('fxpay.purchase() on the web', function() {
  var utils = fxpay.getattr('utils');

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

  beforeEach(function(done) {
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

    fxpay.init({
      oninit: function() {
        done();
      },
      onerror: function(err) {
        done(err);
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

  it('should open a payment window and call back', function (done) {

    fxpay.purchase(productId, function(err) {
      assert.equal(
        fakePayWindow.location, providerUrlTemplate.replace('{jwt}', fakeJwt));
      assert(windowSpy.close.called);
      done(err);
    });

    helper.finishPurchaseOk('<receipt>', {
      productData: {webpayJWT: fakeJwt},
      payCompleter: function() {
        simulatePostMessage({status: 'ok'});
      }
    });
  });

  it('should call back with payment errors', function (done) {

    fxpay.purchase(productId, function(err) {
      assert.instanceOf(err, fxpay.errors.FailedWindowMessage);
      assert.equal(err.code, 'DIALOG_CLOSED_BY_USER');
      assert(windowSpy.close.called);
      done();
    });

    helper.finishPurchaseOk('<receipt>', {
      productData: {webpayJWT: fakeJwt},
      payCompleter: function() {
        simulatePostMessage({status: 'failed',
                             errorCode: 'DIALOG_CLOSED_BY_USER'});
      }
    });
  });

  it('should allow client to specify a custom window', function (done) {

    fxpay.purchase(productId, function(err) {
      assert.equal(
        customPayWindow.location,
        providerUrlTemplate.replace('{jwt}', fakeJwt));
      assert(customWindowSpy.resizeTo.called);
      assert(customWindowSpy.moveTo.called);
      assert(customWindowSpy.close.called);
      done(err);
    }, {
      paymentWindow: customPayWindow,
      managePaymentWindow: true,
    });

    helper.finishPurchaseOk('<receipt>', {
      productData: {webpayJWT: fakeJwt},
      payCompleter: function() {
        simulatePostMessage({status: 'ok'});
      }
    });
  });

  it('should not manage custom pay windows by default', function (done) {

    fxpay.purchase(productId, function(err) {
      assert.equal(
        customPayWindow.location,
        providerUrlTemplate.replace('{jwt}', fakeJwt));
      assert(!customWindowSpy.close.called);
      done(err);
    }, {
      paymentWindow: customPayWindow,
    });

    helper.finishPurchaseOk('<receipt>', {
      productData: {webpayJWT: fakeJwt},
      payCompleter: function() {
        simulatePostMessage({status: 'ok'});
      }
    });
  });

  it('should close payment window on adapter errors', function (done) {
    fxpay.settings.adapter.startTransaction = function(opt, callback) {
      callback('SOME_EARLY_ERROR');
    };

    fxpay.purchase(productId, function(err) {
      assert.equal(err, 'SOME_EARLY_ERROR');
      assert(windowSpy.close.called);
      done();
    });
  });

  it('should not close managed window on adapter errors', function (done) {
    fxpay.settings.adapter.startTransaction = function(opt, callback) {
      callback('SOME_EARLY_ERROR');
    };

    fxpay.purchase(productId, function(err) {
      assert.equal(err, 'SOME_EARLY_ERROR');
      assert(!customWindowSpy.close.called);
      done();
    }, {
      paymentWindow: customPayWindow,
    });
  });

  it('should close payment window on pay module errors', function (done) {

    fxpay.purchase(productId, function(err) {
      assert.instanceOf(err, fxpay.errors.InvalidJwt);
      assert(windowSpy.close.called);
      done();
    });

    // Force an unexpected JWT type error.
    var req = {typ: 'unknown/provider/id'};
    var badJwt = '<algo>.' + btoa(JSON.stringify(req)) + '.<sig>';

    helper.finishPurchaseOk('<receipt>', {
      productData: {webpayJWT: badJwt},
      payCompleter: function() {},
    });
  });

  it('should respond to user closed window', function (done) {

    fxpay.purchase(productId, function(err) {
      assert(window.clearInterval.called, 'clearInterval should be called');
      assert.instanceOf(err, fxpay.errors.PayWindowClosedByUser);
      assert.equal(err.code, 'DIALOG_CLOSED_BY_USER');
      done();
    });

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


describe('fxpay.pay.processPayment()', function() {

  it('should reject calls without a paymentWindow', function(done) {
    fxpay.configure({mozPay: false});
    fxpay.pay.processPayment('<jwt>', function(error) {
      assert.instanceOf(error, fxpay.errors.IncorrectUsage);
      done();
    });
  });

});


describe('fxpay.pay.acceptPayMessage()', function() {
  var utils = fxpay.getattr('utils');
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
    fxpay.pay.acceptPayMessage(
      makeEvent(), defaultOrigin,
      fakeWindow, function(err) {
        done(err);
      }
    );
  });

  it('calls back with error code on failure', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({status: 'failed', errorCode: 'EXTERNAL_CODE'}),
      defaultOrigin, fakeWindow, function(err) {
        assert.instanceOf(err, fxpay.errors.FailedWindowMessage);
        assert.equal(err.code, 'EXTERNAL_CODE');
        done();
      }
    );
  });

  it('rejects unknown statuses', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({status: 'cheezborger'}),
      defaultOrigin, fakeWindow, function(err) {
        assert.instanceOf(err, fxpay.errors.FailedWindowMessage);
        done();
      }
    );
  });

  it('rejects undefined data', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({data: null}), defaultOrigin,
      fakeWindow, function(err) {
        assert.instanceOf(err, fxpay.errors.FailedWindowMessage);
        done();
      }
    );
  });

  it('rejects foreign messages', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({origin: 'http://bar.com'}), 'http://foo.com', fakeWindow,
      function(err) {
        assert.instanceOf(err, fxpay.errors.UnknownMessageOrigin);
        done();
      }
    );
  });

  it('had window closed by user via an unload event', function(done) {
    fakeWindow.closed = true;
    fxpay.pay.acceptPayMessage(
      makeEvent({status: 'unloaded'}),
      defaultOrigin, fakeWindow, function(err) {
        assert.instanceOf(err, fxpay.errors.PayWindowClosedByUser);
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
