(function() {
  "use strict";
  // This is a very minimal JWT utility. It does not validate signatures.

  var exports = fxpay.jwt = {};

  var errors = fxpay.getattr('errors');
  var settings = fxpay.getattr('settings');


  exports.decode = function jwt_decode(jwt, callback) {
    var parts = jwt.split('.');

    if (parts.length !== 3) {
      settings.log.debug('JWT: not enough segments:', jwt);
      return callback(errors.InvalidJwt('JWT does not have 3 segments'));
    }

    var jwtData = parts[1];
    // Normalize URL safe base64 into regular base64.
    jwtData = jwtData.replace("-", "+", "g").replace("_", "/", "g");
    var jwtString;
    try {
      jwtString = atob(jwtData);
    } catch (error) {
      return callback(errors.InvalidJwt(
                        'atob() error: ' + error.toString() +
                        ' when decoding JWT ' + jwtData));
    }
    var data;

    try {
      data = JSON.parse(jwtString);
    } catch (error) {
      return callback(errors.InvalidJwt(
                        'JSON.parse() error: ' + error.toString() +
                        ' when parsing ' + jwtString));
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
        return callback(errors.InvalidJwt(
                          'JWT type ' + jwtData.typ +
                          ' does not map to any known payment providers'));
      }
      if (payUrl.indexOf('{jwt}') === -1) {
        return callback(errors.ConfigurationError(
                          'JWT type ' + jwtData.typ +
                          ' pay URL is formatted incorrectly: ' + payUrl));
      }

      payUrl = payUrl.replace('{jwt}', encodedJwt);
      settings.log.info('JWT', jwtData.typ, 'resulted in pay URL:', payUrl);
      callback(null, payUrl);
    });
  };

})();
