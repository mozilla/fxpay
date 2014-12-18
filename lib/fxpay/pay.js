(function() {
  "use strict";

  var exports = window.fxpay.utils.namespace('fxpay.pay');
  var jwt = require('fxpay/jwt');
  var settings = require('fxpay/settings');
  var utils = require('fxpay/utils');


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


  exports.acceptPayMessage = function pay_acceptPayMessage(event,
                                                           allowedOrigin,
                                                           callback) {
    settings.log.debug('received', event.data, 'from', event.origin);
    if (event.origin !== allowedOrigin) {
      settings.log.debug('ignoring message from foreign window at',
                         event.origin);
      return callback('UNKNOWN_MESSAGE_ORIGIN');
    }
    var eventData = event.data || {};

    if (eventData.status === 'ok') {
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

      // Poll the window for closure.
      var pollIntervalRef = window.setInterval(function() {
        if (paymentWindow === null || paymentWindow.closed === true) {
          window.clearInterval(pollIntervalRef);
          console.log('User closed the window');
          return callback('DIALOG_CLOSED_BY_USER');
        }
      }, 250);

      function receivePaymentMessage(event) {
        exports.acceptPayMessage(event, utils.getUrlOrigin(payUrl),
                                 function(err) {
          if (err === 'UNKNOWN_MESSAGE_ORIGIN') {
            // These could come from anywhere so ignore them.
            return;
          }
          settings.window.removeEventListener('message',
                                              receivePaymentMessage);
          window.clearInterval(pollIntervalRef);
          paymentWindow.close();
          if (err) {
            return callback(err);
          }
          callback();
        });
      }

      settings.window.addEventListener('message', receivePaymentMessage);

    });
  }

  exports._processWebPayment = processWebPayment;

})();
