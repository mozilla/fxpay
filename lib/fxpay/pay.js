(function() {
  "use strict";

  var exports = window.fxpay.utils.namespace('fxpay.pay');
  var jwt = require('fxpay/jwt');
  var settings = require('fxpay/settings');


  exports.processPayment = function pay_processPayment(jwts, callback, opt) {
    opt = opt || {};
    if (settings.mozPay) {
      settings.log.info('processing payment with mozPay');

      var payReq = settings.mozPay(jwts);

      payReq.onerror = function mozPay_onerror() {
        settings.log.error('mozPay: received onerror():', this.error.name);
        callback(this.error.name);
      };

      payReq.onsuccess = function mozPay_onsuccess() {
        settings.log.debug('mozPay: received onsuccess()');
        callback();
      };

    } else {
      if (!opt.paymentWindow) {
        throw new Error('Cannot start a web payment without a ' +
                        'reference to the payment window');
      }
      settings.log.info('processing payment with web flow');
      return processWebPayment(opt.paymentWindow, jwts[0], callback);
    }
  };


  function processWebPayment(paymentWindow, payJwt, callback) {
    jwt.getPayUrl(payJwt, function(err, payUrl) {
      if (err) {
        return callback(err);
      }
      // Now that we've extracted a payment URL from the JWT,
      // load it into the freshly created popup window.
      paymentWindow.location = payUrl;

      // TODO: wait for postMessage result.
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1101995
      // Until then, pretend we have immediate success.
      callback();
    });
  }

})();
