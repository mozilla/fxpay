describe('fxpay.jwt.decode()', function() {

  it('should decode JWTs', function(done) {
    var fakeJwt = {
      aud: 'payments-alt.allizom.org',
      request: {simulate: {result: 'postback'},
                pricePoint: '10'}
    };
    var encJwt = '<algo>.' + btoa(JSON.stringify(fakeJwt)) + '.<sig>';

    fxpay.jwt.decode(encJwt, function(err, data) {
      // Do a quick sanity check that this was decoded.

      assert.deepPropertyVal(data, 'aud', fakeJwt.aud);
      assert.deepPropertyVal(data, 'request.simulate.result',
                             fakeJwt.request.simulate.result);
      assert.deepPropertyVal(data, 'request.pricePoint',
                             fakeJwt.request.pricePoint);
      done(err);
    });
  });

  it('should decode URL safe JWTs', function(done) {
    // This JWT has `-` and `_` chars which need to be converted.
    var encJwt =
      "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJhdWQiOiAibW9j" +
      "a3BheXByb3ZpZGVyLnBocGZvZ2FwcC5jb20iLCAiaXNzIjogIkVudGVyI" +
      "HlvdSBhcHAga2V5IGhlcmUhIiwgInJlcXVlc3QiOiB7Im5hbWUiOiAiUG" +
      "llY2Ugb2YgQ2FrZSIsICJwcmljZSI6ICIxMC41MCIsICJwcmljZVRpZXI" +
      "iOiAxLCAicHJvZHVjdGRhdGEiOiAidHJhbnNhY3Rpb25faWQ9ODYiLCAi" +
      "Y3VycmVuY3lDb2RlIjogIlVTRCIsICJkZXNjcmlwdGlvbiI6ICJWaXJ0d" +
      "WFsIGNob2NvbGF0ZSBjYWtlIHRvIGZpbGwgeW91ciB2aXJ0dWFsIHR1bW" +
      "15In0sICJleHAiOiAxMzUyMjMyNzkyLCAiaWF0IjogMTM1MjIyOTE5Miw" +
      "gInR5cCI6ICJtb2NrL3BheW1lbnRzL2luYXBwL3YxIn0.QZxc62USCy4U" +
      "IyKIC1TKelVhNklvk-Ou1l_daKntaFI";

    fxpay.jwt.decode(encJwt, function(err, data) {
      assert.deepPropertyVal(data, 'request.name', 'Piece of Cake');
      assert.deepPropertyVal(
        data, 'request.description',
        'Virtual chocolate cake to fill your virtual tummy');
      done(err);
    });
  });

  it('should error on missing segments', function(done) {
    fxpay.jwt.decode('one.two', function(err) {
      assert.equal(err, 'WRONG_JWT_SEGMENT_COUNT');
      done();
    });
  });

  it('should error on invalid binary data', function(done) {
    fxpay.jwt.decode('<algo>.this{}IS not*base64 encoded.<sig>', function(err) {
      assert.equal(err, 'INVALID_JWT_DATA');
      done();
    });
  });

  it('should error on non JSON data within JWT', function(done) {
    var encJwt = '<algo>.' + btoa('(not / valid JSON}') + '.<sig>';
    fxpay.jwt.decode(encJwt, function(err) {
      assert.equal(err, 'INVALID_JWT_DATA');
      done();
    });
  });

});


describe('fxpay.jwt.getPayUrl()', function() {

  it('should pass through parse errors', function(done) {
    var encJwt = '<algo>.' + btoa('(not / valid JSON}') + '.<sig>';
    fxpay.jwt.getPayUrl(encJwt, function(err) {
      assert.equal(err, 'INVALID_JWT_DATA');
      done();
    });
  });

  it('should error on unknown JWT types', function(done) {
    var payRequest = {typ: 'unknown-type'};
    var encJwt = '<algo>.' + btoa(JSON.stringify(payRequest)) + '.<sig>';
    fxpay.jwt.getPayUrl(encJwt, function(err) {
      assert.equal(err, 'UNEXPECTED_JWT_TYPE');
      done();
    });
  });

  it('should error on invalid URL templates', function(done) {
    fxpay.configure({
      payProviderUrls: {
        someType: 'https://pay/start?req={nope}'  // missing {req}
      }
    });
    var payRequest = {typ: 'someType'};
    var encJwt = '<algo>.' + btoa(JSON.stringify(payRequest)) + '.<sig>';
    fxpay.jwt.getPayUrl(encJwt, function(err) {
      assert.equal(err, 'INVALID_PAY_PROVIDER_URL');
      done();
    });
  });

  it('should return a JWT formatted URL', function(done) {
    fxpay.configure({
      payProviderUrls: {
        someType: 'https://pay/start?req={jwt}'
      }
    });

    var payRequest = {typ: 'someType'};
    var encJwt = '<algo>.' + btoa(JSON.stringify(payRequest)) + '.<sig>';

    fxpay.jwt.getPayUrl(encJwt, function(err, payUrl) {
      assert.equal(payUrl, 'https://pay/start?req=' + encJwt);
      done(err);
    });
  });

});
