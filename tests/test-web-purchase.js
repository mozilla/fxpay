describe('fxpay.purchase() on the web', function() {

  beforeEach(function(done) {
    helper.setUp();
    fxpay.configure({
      appSelf: null,
      mozApps: null,
      mozPay: null,
      apiUrlBase: 'https://not-the-real-marketplace',
      apiVersionPrefix: '/api/v1',
    });
    fxpay.init({
      oninit: function() {
        done();
      },
      onerror: function(err) {
        done(err);
      }
    });
  });

  afterEach(function() {
    helper.tearDown();
    helper.receiptAdd.reset();
  });

  it('should open a payment window on the web', function (done) {
    var payReq = {typ: 'mozilla/payments/pay/v1'};
    var fakeJwt = '<algo>.' + btoa(JSON.stringify(payReq)) + '.<sig>';
    var productId = 'some-uuid';
    var fakeWindow = {};

    fxpay.configure({
      openWindow: function() {
        return fakeWindow;
      }
    });

    fxpay.purchase(productId, function(err) {
      assert.equal(
        fakeWindow.location,
        helper.settings.payProviderUrls[payReq.typ].replace('{jwt}', fakeJwt));
      // TODO: check for success/fail codes.
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1101995
      done(err);
    });

    helper.finishPurchaseOk('<receipt>',
                            {productData: {webpayJWT: fakeJwt}});
  });
});
