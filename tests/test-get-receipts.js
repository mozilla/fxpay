describe('fxpay.receipts.all()', function() {

  beforeEach(function() {
    helper.setUp();
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('exposes mozApps receipts', function() {
    var receipt = '<receipt>';
    fxpay.configure({
      appSelf: {
        receipts: [receipt]
      }
    });
    var fetchedReceipts = fxpay.receipts.all();
    assert.equal(fetchedReceipts[0], receipt);
    assert.equal(fetchedReceipts.length, 1);
  });

  it('ignores missing receipts', function() {
    fxpay.configure({appSelf: {}});  // no receipts property
    var fetchedReceipts = fxpay.receipts.all();
    assert.equal(fetchedReceipts.length, 0);
  });

  it('gets mozApps receipts and localStorage ones', function() {
    var receipt1 = '<receipt1>';
    var receipt2 = '<receipt2>';

    fxpay.configure({
      appSelf: {
        receipts: [receipt1]
      }
    });
    window.localStorage.setItem(helper.settings.localStorageKey,
                                JSON.stringify([receipt2]));

    var fetchedReceipts = fxpay.receipts.all();
    assert.equal(fetchedReceipts[0], receipt1);
    assert.equal(fetchedReceipts[1], receipt2);
    assert.equal(fetchedReceipts.length, 2);
  });

  it('filters out dupe receipts', function() {
    var receipt1 = '<receipt1>';

    fxpay.configure({
      appSelf: {
        receipts: [receipt1]
      }
    });
    window.localStorage.setItem(helper.settings.localStorageKey,
                                JSON.stringify([receipt1]));

    var fetchedReceipts = fxpay.receipts.all();
    assert.equal(fetchedReceipts[0], receipt1);
    assert.equal(fetchedReceipts.length, 1);
  });

  it('handles initialization errors', function() {
    fxpay.configure({
      appSelf: null  // default state before initializaion.
    });
    var fetchedReceipts = fxpay.receipts.all();
    assert.equal(fetchedReceipts.length, 0);
  });

});
