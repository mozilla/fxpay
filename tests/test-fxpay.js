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

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /http.*\/payments\/in\-app\/purchase\/product\/123/,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({webpayJWT: webpayJWT,
                         contribStatusURL: '/transaction/XYZ'})]);
      server.respond();

      mozPay.returnValues[0].onsuccess();  // resolve the DOM request.

      // Respond to polling the transaction.
      // TODO: make the state value realistic.
      server.respondWith(
        'POST',
        /http.*\/transaction\/XYZ/,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({state: 'COMPLETED'})]);
      server.respond();
    });

    it('should report XHR abort', function (done) {
      server.respondWith(function(xhr, id) {
        // We use a custom event because xhr.abort() triggers load first
        // (probably a sinon bug).
        dispatchXhrEvent(xhr, 'abort');
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
        dispatchXhrEvent(xhr, 'error');
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

    it('should timeout polling the transaction', function (done) {
      var productId = 123;

      fxpay.purchase(productId, {
        onpurchase: function(err) {
          console.log('GOT error', err);
          assert.equal(err, 'TRANSACTION_TIMEOUT');
          done();
        },
        mozPay: mozPay,
        maxTries: 2,
        pollIntervalMs: 1
      });

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /http.*\/payments\/in\-app\/purchase\/product\/123/,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({webpayJWT: '<jwt>',
                         contribStatusURL: '/transaction/XYZ'})]);
      server.respond();

      mozPay.returnValues[0].onsuccess();  // resolve the DOM request.

      // Respond to polling the transaction.
      // TODO: make the state value realistic.
      server.autoRespond = true;
      server.respondWith(
        'POST',
        /http.*\/transaction\/XYZ/,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({state: 'PENDING'})]);
      server.respond();
    });

    it('should report invalid transaction state', function (done) {
      var productId = 123;

      fxpay.purchase(productId, {
        onpurchase: function(err) {
          assert.equal(err, 'INVALID_TRANSACTION_STATE');
          done();
        },
        mozPay: mozPay
      });

      // Respond to fetching the JWT.
      server.respondWith(
        'POST',
        /http.*\/payments\/in\-app\/purchase\/product\/123/,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({webpayJWT: '<jwt>',
                         contribStatusURL: '/transaction/XYZ'})]);
      server.respond();

      mozPay.returnValues[0].onsuccess();  // resolve the DOM request.

      // Respond to polling the transaction.
      server.respondWith(
        'POST',
        /http.*\/transaction\/XYZ/,
        [200, {"Content-Type": "application/json"},
         JSON.stringify({state: 'THIS_IS_NOT_A_VALID_STATE'})]);
      server.respond();
    });
  });
});


function dispatchXhrEvent(xhr, eventName, bubbles, cancelable) {
  xhr.dispatchEvent(new sinon.Event(eventName, bubbles, cancelable, xhr));
  // Prevent future listening, like, in future tests.
  // Make this is fixed now?
  // See https://github.com/cjohansen/Sinon.JS/issues/430
  xhr.eventListeners = {};
}


function mozPayStub() {
  // https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
  return {
    onsuccess: function() {},
    onerror: function() {}
  };
}
