describe('fxpay.purchase() on B2G', function () {
  var mozPay;

  beforeEach(function() {
    helper.setUp();
    mozPay = sinon.spy(helper.mozPayStub);
    fxpay.configure({
      appSelf: helper.appSelf,
      mozPay: mozPay,
    });
  });

  afterEach(function() {
    helper.tearDown();
    mozPay.reset();
    helper.receiptAdd.reset();
  });

  it('should send a JWT to mozPay', function (done) {
    var webpayJWT = '<base64 JWT>';
    var productId = 'some-guid';
    var cfg = {
      apiUrlBase: 'https://not-the-real-marketplace',
      apiVersionPrefix: '/api/v1',
      adapter: null,
    };
    fxpay.configure(cfg);

    fxpay.purchase(productId, function(err, info) {
      assert.ok(mozPay.called);
      assert.ok(mozPay.calledWith([webpayJWT]), mozPay.firstCall);
      assert.equal(info.productId, helper.apiProduct.guid);
      done(err);
    });

    // Respond to fetching the JWT.
    helper.server.respondWith(
      'POST',
      cfg.apiUrlBase + cfg.apiVersionPrefix + '/webpay/inapp/prepare/',
      // TODO: assert somehow that productId is part of post data.
      helper.productData({webpayJWT: webpayJWT}));
    helper.server.respond();

    mozPay.returnValues[0].onsuccess();

    helper.server.respondWith('GET', cfg.apiUrlBase + '/transaction/XYZ',
                              helper.transactionData());
    helper.server.respond();

    helper.server.respondWith('GET', new RegExp('.*/payments/.*/in-app/.*'),
                              [200, {"Content-Type": "application/json"},
                               JSON.stringify(helper.apiProduct)]);

    helper.receiptAdd.onsuccess();
    helper.server.respond();
  });

  it('should timeout polling the transaction', function (done) {
    var productId = 'some-guid';

    fxpay.purchase(productId, function(err, info) {
      assert.equal(err, 'TRANSACTION_TIMEOUT');
      assert.equal(info.productId, productId);
      done();
    }, {
      maxTries: 2,
      pollIntervalMs: 1
    });

    // Respond to fetching the JWT.
    helper.server.respondWith('POST', /http.*\/webpay\/inapp\/prepare/,
                              helper.productData());
    helper.server.respond();

    mozPay.returnValues[0].onsuccess();

    helper.server.autoRespond = true;
    helper.server.respondWith('GET', /http.*\/transaction\/XYZ/,
                              helper.transactionData({status: 'incomplete'}));
    helper.server.respond();
  });

  it('should call back with mozPay error', function (done) {
    var productId = 'some-guid';

    fxpay.purchase(productId, function(err, info) {
      assert.equal(err, 'DIALOG_CLOSED_BY_USER');
      assert.equal(info.productId, productId);
      done();
    });

    // Respond to fetching the JWT.
    helper.server.respondWith('POST', /.*webpay\/inapp\/prepare/,
                              helper.productData());
    helper.server.respond();

    var domReq = mozPay.returnValues[0];
    domReq.error = {name: 'DIALOG_CLOSED_BY_USER'};
    domReq.onerror();
  });

  it('should report invalid transaction state', function (done) {

    fxpay.purchase(helper.apiProduct.guid, function(err) {
      assert.equal(err, 'INVALID_TRANSACTION_STATE');
      done();
    });

    // Respond to fetching the JWT.
    helper.server.respondWith('POST', /http.*\/webpay\/inapp\/prepare/,
                              helper.productData());
    helper.server.respond();

    mozPay.returnValues[0].onsuccess();

    // Respond to polling the transaction.
    helper.server.respondWith(
      'GET', /http.*\/transaction\/XYZ/,
      helper.transactionData({status: 'THIS_IS_NOT_A_VALID_STATE'}));
    helper.server.respond();

    helper.receiptAdd.onsuccess();
  });

  it('should add receipt to device with addReceipt', function (done) {
    var receipt = '<receipt>';

    fxpay.purchase(helper.apiProduct.guid, function(err) {
      assert.equal(helper.receiptAdd._receipt, receipt);
      done(err);
    });

    helper.finishPurchaseOk(receipt, {mozPay: mozPay});
  });

  it('should call back with complete product info', function (done) {

    fxpay.purchase(helper.apiProduct.guid, function(err, info) {
      if (!err) {
        assert.equal(info.productId, helper.apiProduct.guid);
        assert.equal(info.name, helper.apiProduct.name);
        assert.equal(info.smallImageUrl, helper.apiProduct.logo_url);
      }
      done(err);
    });

    helper.finishPurchaseOk('<receipt>', {mozPay: mozPay});
  });

  it('should fetch stub products when using fake products', function (done) {
    fxpay.configure({fakeProducts: true});

    fxpay.purchase(helper.apiProduct.guid, function(err, info) {
      if (!err) {
        assert.equal(info.productId, helper.apiProduct.guid);
        assert.equal(info.name, helper.apiProduct.name);
        assert.equal(info.smallImageUrl, helper.apiProduct.logo_url);
      }
      done(err);
    });

    helper.finishPurchaseOk('<receipt>', {
      fetchProductsPattern: /.*\/stub-in-app-products\/.*/,
      mozPay: mozPay
    });
  });

  it('should add receipt to device with localStorage', function (done) {
    var receipt = '<receipt>';

    setUpLocStorAddReceipt(done);

    // Without addReceipt(), receipt should go in localStorage.

    fxpay.purchase(helper.apiProduct.guid, function(err) {
      if (!err) {
        assert.equal(
          JSON.parse(
            window.localStorage.getItem(helper.settings.localStorageKey))[0],
          receipt);
      }
      done(err);
    });

    helper.finishPurchaseOk(receipt, {mozPay: mozPay});
  });

  it('should not add dupes to localStorage', function (done) {
    var receipt = '<receipt>';

    setUpLocStorAddReceipt(done);

    // Set up an already stored receipt.
    window.localStorage.setItem(helper.settings.localStorageKey,
                                JSON.stringify([receipt]));

    fxpay.purchase(helper.apiProduct.guid, function(err) {
      if (!err) {
        var addedReceipts = JSON.parse(
          window.localStorage.getItem(helper.settings.localStorageKey));
        // Make sure a new receipt wasn't added.
        assert.equal(addedReceipts.length, 1);
      }
      done(err);
    });

    helper.finishPurchaseOk(receipt, {mozPay: mozPay});
  });

  it('should pass through receipt errors', function (done) {

    fxpay.purchase(helper.apiProduct.guid, function(err) {
      assert.equal(err, 'ADD_RECEIPT_ERROR');
      done();
    });

    // Respond to fetching the JWT.
    helper.server.respondWith('POST', /.*\/webpay\/inapp\/prepare/,
                              helper.productData());
    helper.server.respond();

    mozPay.returnValues[0].onsuccess();

    helper.server.respondWith('GET', /.*\/transaction\/XYZ/,
                              helper.transactionData());
    helper.server.respond();

    // Simulate a receipt installation error.
    helper.receiptAdd.error = {name: 'ADD_RECEIPT_ERROR'};
    helper.receiptAdd.onerror();
  });


  function setUpLocStorAddReceipt(done) {
    // Set up a purchase where mozApps does not support addReceipt().
    delete helper.appSelf.addReceipt;

    // Re-initialize to detect lack of addReceipt().
    fxpay.init({
      oninit: function() {},
      onerror: function(err) {
        done(err);
      }
    });

    helper.appSelf.onsuccess();
  }

});
