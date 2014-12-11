(function() {
  "use strict";

  var exports = window.fxpay.utils.namespace('fxpay.pay');
  var settings = require('fxpay/settings');


  exports.processPayment = function pay_processPayment(jwts, callback) {
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
      settings.log.info('processing payment with web flow');
      return processWebPayment(jwts, callback);
    }
  };


  function processWebPayment(jwts, callback) {
    return callback('WEB_FLOW_NOT_IMPLEMENTED');
  }

})();
