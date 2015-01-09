(function() {
  "use strict";
  // This is a very minimal JWT utility. It does not validate signatures.

  var exports = fxpay.jwt = {};
  var settings = fxpay.getattr('settings');


  exports.decode = function jwt_decode(jwt, callback) {
    var parts = jwt.split('.');
    if (parts.length !== 3) {
      settings.log.error('JWT does not have 3 segments:', jwt);
      return callback('WRONG_JWT_SEGMENT_COUNT');
    }

    var jwtData = parts[1];
    // Normalize URL safe base64 into regular base64.
    jwtData = jwtData.replace("-", "+", "g").replace("_", "/", "g");
    var jwtString;
    try {
      jwtString = atob(jwtData);
    } catch (error) {
      settings.log.error('atob() error:', error.toString(),
                         'when decoding JWT', jwtData);
      return callback('INVALID_JWT_DATA');
    }
    var data;

    try {
      data = JSON.parse(jwtString);
    } catch (error) {
      settings.log.error('JSON.parse() error:', error.toString(),
                         'when parsing', jwtString);
      return callback('INVALID_JWT_DATA');
    }
    callback(null, data);
  };


  exports.getPayUrl = function jwt_getPayUrl(encodedJwt, callback) {
    exports.decode(encodedJwt, function(err, jwtData) {
      if (err) {
        return callback(err);
      }

      var payUrl = settings.payProviderUrls[jwtData.typ];
      if (!payUrl) {
        settings.log.error('JWT type', jwtData.typ,
                           'does not map to any known payment providers');
        return callback('UNEXPECTED_JWT_TYPE');
      }
      if (payUrl.indexOf('{jwt}') === -1) {
        settings.log.error('JWT type', jwtData.typ,
                           'pay URL is formatted incorrectly:', payUrl);
        return callback('INVALID_PAY_PROVIDER_URL');
      }

      payUrl = payUrl.replace('{jwt}', encodedJwt);
      settings.log.info('JWT', jwtData.typ, 'resulted in pay URL:', payUrl);
      callback(null, payUrl);
    });
  };

})();
