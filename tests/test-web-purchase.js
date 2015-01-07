describe('fxpay.purchase() on the web', function() {
  var utils = require('fxpay/utils');

  var payReq = {typ: 'mozilla/payments/pay/v1'};
  var fakeJwt = '<algo>.' + btoa(JSON.stringify(payReq)) + '.<sig>';
  var productId = 'some-uuid';

  var providerUrlTemplate;
  var fakePayWindow;
  var windowSpy;
  var handlers;

  beforeEach(function(done) {
    helper.setUp();
    handlers = {};
    fakePayWindow = {
      close: function() {
      },
    };
    windowSpy = {
      close: sinon.spy(fakePayWindow, 'close'),
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
  });

  afterEach(function() {
    helper.tearDown();
    helper.receiptAdd.reset();
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
      assert.equal(err, 'DIALOG_CLOSED_BY_USER');
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


  function simulatePostMessage(data) {
    handlers.message({data: data,
                      origin: utils.getUrlOrigin(providerUrlTemplate)});
  }

});


describe('fxpay.pay.acceptPayMessage()', function() {
  var utils = require('fxpay/utils');
  var defaultOrigin = 'http://marketplace.firefox.com';

  it('calls back on success', function(done) {
    fxpay.pay.acceptPayMessage(makeEvent(), defaultOrigin, function(err) {
      done(err);
    });
  });

  it('calls back with error code on failure', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({status: 'failed', errorCode: 'EXTERNAL_CODE'}),
      defaultOrigin, function(err) {
        assert.equal(err, 'EXTERNAL_CODE');
        done();
      }
    );
  });

  it('calls back with generic error code', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({status: 'failed', errorCode: null}),
      defaultOrigin, function(err) {
        assert.equal(err, 'PAY_WINDOW_FAIL_MESSAGE');
        done();
      }
    );
  });

  it('rejects unknown statuses', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({status: 'cheezborger'}),
      defaultOrigin, function(err) {
        assert.equal(err, 'UNKNOWN_MESSAGE_STATUS');
        done();
      }
    );
  });

  it('rejects undefined data', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({data: null}), defaultOrigin,
      function(err) {
        assert.equal(err, 'UNKNOWN_MESSAGE_STATUS');
        done();
      }
    );
  });

  it('rejects foreign messages', function(done) {
    fxpay.pay.acceptPayMessage(
      makeEvent({origin: 'http://bar.com'}),
      'http://foo.com', function(err) {
        assert.equal(err, 'UNKNOWN_MESSAGE_ORIGIN');
        done();
      }
    );
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
