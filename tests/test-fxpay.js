describe('fxpay', function () {
  var mozPay;
  var server;

  beforeEach(function() {
    console.log('beginEach');
    server = sinon.fakeServer.create();
    mozPay = sinon.spy(mozPayStub);
  });

  afterEach(function() {
    server.restore();
    mozPay.reset();
  });

  describe('purchase()', function () {

    it('should send a JWT to mozPay', function (done) {
      var productId = 123;
      var webpayJWT = '<base64 JWT>';

      server.respondWith(
        'POST',
        /http.*\/payments\/in\-app\/purchase\/product\/123/,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({webpayJWT: webpayJWT,
                         contribStatusURL: '/somewhere'})]);

      fxpay.purchase(productId, {
        onpurchase: function(err) {
          if (!err) {
            assert.ok(mozPay.called);
            assert.ok(mozPay.calledWith([webpayJWT]), mozPay.firstCall);
          }
          done(err);
        },
        mozPay: mozPay
      });

      server.respond();
      mozPay.returnValues[0].onsuccess();  // resolve the DOM request.
    });

    it('should report XHR abort', function (done) {
      server.respondWith(function(xhr, id) {
        // This is dumb but xhr.abort() triggers load first.
        xhr.dispatchEvent(new sinon.Event("abort", false, false, xhr));
      });

      fxpay.purchase(123, {
        onpurchase: function(err) {
          assert.equal(err, 'API_REQUEST_ABORTED');
          done();
        },
        mozPay: mozPay
      });

      server.respond();
    });

    it('should report XHR errors', function (done) {
      server.respondWith(function(xhr, id) {
        xhr.dispatchEvent(new sinon.Event("error", false, false, xhr));
      });

      fxpay.purchase(123, {
        onpurchase: function(err) {
          assert.equal(err, 'API_REQUEST_ERROR');
          done();
        },
        mozPay: mozPay
      });

      server.respond();
    });

    it('should report non-200 responses', function (done) {
      server.respondWith(
        'POST',
        /http.*\/payments\/in\-app\/purchase\/product\/123/,
        [500, {"Content-Type": "application/json"},
         JSON.stringify({webpayJWT: '<jwt>',
                         contribStatusURL: '/somewhere'})]);

      fxpay.purchase(123, {
        onpurchase: function(err) {
          assert.equal(err, 'BAD_API_RESPONSE');
          done();
        },
        mozPay: mozPay
      });

      server.respond();
    });

    it('should report unparsable JSON', function (done) {
      server.respondWith(
        'POST',
        /http.*\/payments\/in\-app\/purchase\/product\/123/,
        [200, {"Content-Type": "application/json"},
         "{this\is not; valid JSON'"]);

      fxpay.purchase(123, {
        onpurchase: function(err) {
          assert.equal(err, 'BAD_JSON_RESPONSE');
          done();
        },
        mozPay: mozPay
      });

      server.respond();
    });
  });
});


function mozPayStub() {
  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
  return {
    onsuccess: function() {},
    onerror: function() {}
  };
}
