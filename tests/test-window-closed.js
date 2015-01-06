describe('window closed by user', function() {

  var pay = require('fxpay/pay');
  var payReq = {typ: 'mozilla/payments/pay/v1'};
  var fakeJwt = '<algo>.' + btoa(JSON.stringify(payReq)) + '.<sig>';
  var fakeWindow;
  var windowSpy;

  beforeEach(function() {
    fakeWindow = {
      location: '',
      close: function() {
      },
      closed: true,
    };
    windowSpy = {
      close: sinon.spy(fakeWindow, 'close'),
    };
  });

  afterEach(function() {
    windowSpy.close.restore();
  });

  it('should callback when closed by user', function (done) {

    pay._processWebPayment(fakeWindow, fakeJwt, function(err) {
      assert.equal(err, 'DIALOG_CLOSED_BY_USER');
      assert.equal(windowSpy.close.callCount, 0);
      done();
    });
  });

});
