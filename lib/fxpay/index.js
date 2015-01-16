(function() {
  'use strict';

  // This object is created by init_module.js
  var exports = window.fxpay;

  var pay = fxpay.getattr('pay');
  var settings = fxpay.getattr('settings');
  var products = fxpay.getattr('products');
  var utils = fxpay.getattr('utils');

  //
  // publicly exported functions:
  //


  exports.configure = function() {
    return settings.configure.apply(settings, arguments);
  };


  // Initialize settings with default values.
  exports.configure({}, {reset: true});


  exports.init = function _init(opt) {
    opt = opt || {};

    function storeError(err) {
      settings.initError = err;
      return settings.onerror(settings.initError);
    }

    exports.configure(opt);

    getAppSelf(function(err, appSelf) {
      if (err) {
        return storeError(err);
      }
      settings.appSelf = appSelf;

      settings.hasAddReceipt = (settings.appSelf &&
                                settings.appSelf.addReceipt);

      settings.adapter.init(function(err) {
        if (err) {
          return storeError(err);
        }

        // Initialization succeeded; clear the stored error.
        settings.initError = null;
        settings.oninit();
      });
    });
  };


  exports.purchase = function _purchase(productId, onPurchase, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || undefined;
    opt.pollIntervalMs = opt.pollIntervalMs || undefined;

    var partialProdInfo = {productId: productId};
    var log = settings.log;
    var paymentWindow;

    if (!onPurchase) {
      onPurchase = function _onPurchase(err, returnedProdInfo) {
        if (err) {
          throw err;
        }
        console.log('product', returnedProdInfo.productId, 'purchased');
      };
    }

    if (settings.initError) {
      settings.log.error('init failed:', settings.initError);
      return onPurchase(settings.initError, partialProdInfo);
    }

    log.debug('starting purchase for product', productId);

    if (!settings.mozPay) {
      // Open a blank payment window on the same event loop tick
      // as the click handler. This avoids popup blockers.
      // TODO: maybe we should inject some HTML/CSS to indicate
      // loading/progress. We probably also need to display any
      // errors that might occur from the Ajax request to get a JWT.
      paymentWindow = utils.openWindow();
    }

    settings.adapter.startTransaction({productId: productId},
                                      function(err, transData) {
      if (err) {
        return onPurchase(err, partialProdInfo);
      }
      pay.processPayment(transData.productJWT, function(err) {
        if (err) {
          return onPurchase(err, partialProdInfo);
        }

        // The payment flow has completed. Wait for payment verification.

        waitForTransaction(
          transData,
          function(err, fullProductInfo) {
            onPurchase(err, fullProductInfo || partialProdInfo);
          }, {
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs
          }
        );
      }, {paymentWindow: paymentWindow});
    });
  };


  exports.getProducts = function getProducts() {
    products.all.apply(products, arguments);
  };


  //
  // private functions:
  //


  function getAppSelf(callback) {
    if (!settings.mozApps) {
      settings.log.info(
          'web platform does not define mozApps, cannot get appSelf');
      return callback(null, null);
    }
    var appRequest = settings.mozApps.getSelf();

    appRequest.onsuccess = function() {
      callback(null, this.result);
    };

    appRequest.onerror = function() {
      var err = this.error.name;
      settings.log.error('mozApps.getSelf() returned an error', err);
      callback(err);
    };
  }


  // NOTE: if you change this function signature, change the setTimeout below.
  function waitForTransaction(transData, cb, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || 10;
    opt.pollIntervalMs = opt.pollIntervalMs || 1000;
    opt._tries = opt._tries || 1;

    var log = settings.log;
    log.debug('Getting transaction state for', transData,
              'tries=', opt._tries);

    if (opt._tries > opt.maxTries) {
      log.error('Giving up on transaction for', transData,
                'after', opt._tries, 'tries');
      return cb('TRANSACTION_TIMEOUT');
    }

    settings.adapter.transactionStatus(
        transData, function(err, isComplete, productInfo) {
      if (err) {
        return cb(err);
      }
      if (isComplete) {
        return cb(null, productInfo);
      } else {
        log.debug('Re-trying incomplete transaction in',
                  opt.pollIntervalMs, 'ms');
        window.setTimeout(function() {
          waitForTransaction(transData, cb, {
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs,
            _tries: opt._tries + 1
          });
        }, opt.pollIntervalMs);
      }
    });
  }

})();
