(function() {
  "use strict";

  var exports = fxpay.pay = {};

  var errors = fxpay.getattr('errors');
  var jwt = fxpay.getattr('jwt');
  var settings = fxpay.getattr('settings');
  var utils = fxpay.getattr('utils');
  var timer;


  exports.processPayment = function pay_processPayment(jwt, callback, opt) {
    opt = utils.defaults(opt, {
      managePaymentWindow: true,
      paymentWindow: undefined,
    });

    if (settings.mozPay) {
      settings.log.info('processing payment with mozPay using jwt', jwt);

      var payReq = settings.mozPay([jwt]);

      payReq.onerror = function mozPay_onerror() {
        settings.log.error('mozPay: received onerror():', this.error.name);
        if (settings.onBrokenWebRT &&
            this.error.name === 'USER_CANCELLED') {
          // This is a workaround for bug 1133963.
          settings.log.warn(
            'webRT: pretending the cancel message is actually a success!');
          callback();
        } else {
          callback(fxpay.errors.PayPlatformError(
                                'mozPay error: ' + this.error.name,
                                {code: this.error.name}));
        }
      };

      payReq.onsuccess = function mozPay_onsuccess() {
        settings.log.debug('mozPay: received onsuccess()');
        callback();
      };

    } else {
      if (!opt.paymentWindow) {
        return callback(errors.IncorrectUsage(
                          'Cannot start a web payment without a ' +
                          'reference to the payment window'));
      }
      settings.log.info('processing payment with web flow');
      return processWebPayment(opt.paymentWindow, opt.managePaymentWindow,
                               jwt, callback);
    }
  };


  exports.acceptPayMessage = function pay_acceptPayMessage(event,
                                                           allowedOrigin,
                                                           paymentWindow,
                                                           callback) {
    settings.log.debug('received', event.data, 'from', event.origin);

    if (event.origin !== allowedOrigin) {
      return callback(errors.UnknownMessageOrigin(
                  'ignoring message from foreign window at ' + event.origin));
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
          return callback(
              errors.PayWindowClosedByUser('Window closed by user'));
        }
      }, 300);
    } else if (eventData.status === 'ok') {
      settings.log.info('received pay success message from window at',
                        event.origin);
      return callback();
    } else if (eventData.status === 'failed') {
      return callback(fxpay.errors.FailedWindowMessage(
                'received pay fail message with status=' + eventData.status +
                ', code=' + eventData.errorCode + ' from window at ' +
                event.origin, {code: eventData.errorCode}));
    } else {
      return callback(errors.FailedWindowMessage(
                          'received pay message with unknown status ' +
                          eventData.status + ' from window at ' +
                          event.origin));
    }
  };


  function processWebPayment(paymentWindow, managePaymentWindow, payJwt,
                             callback) {
    jwt.getPayUrl(payJwt, function(err, payUrl) {
      if (err) {
        return callback(err);
      }
      // Now that we've extracted a payment URL from the JWT,
      // load it into the freshly created popup window.
      paymentWindow.location = payUrl;

      // This interval covers closure of the popup
      // whilst on external domains that won't postMessage
      // onunload.
      var popupInterval = setInterval(function() {
        if (!paymentWindow || paymentWindow.closed) {
          clearInterval(popupInterval);
          return callback(errors.PayWindowClosedByUser(
                              'polling detected a closed window'));
        }
      }, 500);

      function receivePaymentMessage(event) {

        function messageCallback(err) {
          if (err instanceof errors.UnknownMessageOrigin) {
            // These could come from anywhere so ignore them.
            return;
          }

          // We know if we're getting messages from our UI
          // at this point so we can do away with the
          // interval watching for the popup closing
          // whilst on 3rd party domains.
          if (popupInterval) {
            clearInterval(popupInterval);
          }

          settings.window.removeEventListener('message',
                                              receivePaymentMessage);
          if (managePaymentWindow) {
            paymentWindow.close();
          } else {
            settings.log.info('payment window should be closed but client ' +
                              'is managing it');
          }
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
