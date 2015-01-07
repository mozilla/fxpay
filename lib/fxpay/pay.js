(function() {
  "use strict";

  var exports = window.fxpay.utils.namespace('fxpay.pay');
  var jwt = require('fxpay/jwt');
  var settings = require('fxpay/settings');
  var utils = require('fxpay/utils');
  var timer;


  exports.processPayment = function pay_processPayment(jwt, callback, opt) {
    opt = opt || {};
    if (settings.mozPay) {
      settings.log.info('processing payment with mozPay using jwt', jwt);

      var payReq = settings.mozPay([jwt]);

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
      return processWebPayment(opt.paymentWindow, jwt, callback);
    }
  };


  exports.acceptPayMessage = function pay_acceptPayMessage(event,
                                                           allowedOrigin,
                                                           paymentWindow,
                                                           callback) {
    settings.log.debug('received', event.data, 'from', event.origin);
    if (event.origin !== allowedOrigin) {
      settings.log.debug('ignoring message from foreign window at',
                         event.origin);
      return callback('UNKNOWN_MESSAGE_ORIGIN');
    }
    var eventData = event.data || {};

    if (eventData.status === 'unloaded') {
      // Look for the window having been closed.
      if (timer) {
        window.clearTimeout(timer);
      }
      // This delay is introduced so that the closed property
      // of the window has time to be updated.
      timer = window.setTimeout(function(){
        if (!paymentWindow || paymentWindow.closed === true) {
          settings.log.info('Window closed by user.');
          return callback('DIALOG_CLOSED_BY_USER');
        }
      }, 300);
    } else if (eventData.status === 'ok') {
      settings.log.info('received pay success message from window at',
                        event.origin);
      return callback();
    } else if (eventData.status === 'failed') {
      settings.log.info('received pay fail message with status',
                        eventData.status, 'code', eventData.errorCode,
                        'from window at', event.origin);
      return callback(eventData.errorCode || 'PAY_WINDOW_FAIL_MESSAGE');
    } else {
      settings.log.info('received pay message with unknown status',
                        eventData.status, 'from window at',
                        event.origin);
      return callback('UNKNOWN_MESSAGE_STATUS');
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

      function receivePaymentMessage(event) {

        function messageCallback(err) {
          if (err === 'UNKNOWN_MESSAGE_ORIGIN') {
            // These could come from anywhere so ignore them.
            return;
          }
          settings.window.removeEventListener('message',
                                              receivePaymentMessage);
          paymentWindow.close();
          if (err) {
            return callback(err);
          }
          callback();
        }

        exports.acceptPayMessage(event, utils.getUrlOrigin(payUrl),
                                 paymentWindow, messageCallback);
      }

      settings.window.addEventListener('message', receivePaymentMessage);

    });
  }

})();
