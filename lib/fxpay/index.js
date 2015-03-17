(function() {
  'use strict';

  // This object is created by init_module.js
  var exports = window.fxpay;

  var errors = fxpay.getattr('errors');
  var pay = fxpay.getattr('pay');
  var receipts = fxpay.getattr('receipts');
  var settings = fxpay.getattr('settings');
  var products = fxpay.getattr('products');
  var utils = fxpay.getattr('utils');

  //
  // publicly exported functions:
  //


  exports.configure = function() {
    return settings.configure.apply(settings, arguments);
  };


  exports.init = function _init(opt) {
    settings.initialize(opt);

    settings.adapter.init(function(err) {
      if (err) {
        return settings.onerror(err);
      }

      settings.oninit();
    });
  };


  exports.validateAppReceipt = function validateAppReceipt() {
    settings.initialize();
    return new Promise(function(resolve, reject) {
      utils.getAppSelf(function(error, appSelf) {
        if (error) {
          return reject(error);
        }
        if (!appSelf) {
          return reject(errors.PayPlatformUnavailable(
                              'mozApps.getSelf() required for receipts'));
        }
        var allAppReceipts = [];

        receipts.all(function(error, allReceipts) {
          if (error) {
            return reject(error);
          }

          allReceipts.forEach(function(receipt) {
            var storedata = receipts.checkStoreData(receipt);
            if (!storedata) {
              settings.log.info(
                'ignoring receipt with missing or unparsable storedata');
              return;
            }
            if (storedata.inapp_id) {
              settings.log.info('ignoring in-app receipt with storedata',
                                storedata);
              return;
            }
            allAppReceipts.push(receipt);
          });

          settings.log.info('app receipts found:', allAppReceipts.length);

          var appReceipt;

          if (allAppReceipts.length === 0) {
            return reject(errors.AppReceiptMissing(
                                'no receipt found in getSelf()'));
          } else if (allAppReceipts.length === 1) {
            appReceipt = allAppReceipts[0];
            settings.log.info('Installed receipt:', appReceipt);
            return receipts.validateAppReceipt(appReceipt,
                                               function(error, productInfo) {
              settings.log.info('got verification result for', productInfo);
              if (error) {
                error.productInfo = productInfo;
                reject(error);
              } else {
                resolve(productInfo);
              }
            });
          } else {
            // TODO: support multiple app stores? bug 1134739.
            // This is an unlikely case where multiple app receipts are
            // installed.
            return reject(errors.NotImplementedError(
                'multiple app receipts were found which is not yet supported'));
          }
        });
      });
    });
  };


  exports.purchase = function _purchase(productId, onPurchase, opt) {
    settings.initialize();
    opt = utils.defaults(opt, {
      maxTries: undefined,
      managePaymentWindow: undefined,
      paymentWindow: undefined,
      pollIntervalMs: undefined,
    });
    if (typeof opt.managePaymentWindow === 'undefined') {
      // By default, do not manage the payment window when a custom
      // window is defined. This means the client must close its own window.
      opt.managePaymentWindow = !opt.paymentWindow;
    }

    var partialProdInfo = {productId: productId};

    if (!onPurchase) {
      onPurchase = function _onPurchase(err, returnedProdInfo) {
        if (err) {
          throw err;
        }
        settings.log.info('product', returnedProdInfo.productId, 'purchased');
      };
    }

    settings.log.debug('starting purchase for product', productId);

    if (!settings.mozPay) {
      if (!opt.paymentWindow) {
        // Open a blank payment window on the same event loop tick
        // as the click handler. This avoids popup blockers.
        opt.paymentWindow = utils.openWindow();
      } else {
        settings.log.info('web flow will use client provided payment window');
        utils.reCenterWindow(opt.paymentWindow,
                             settings.winWidth, settings.winHeight);
      }
    }

    function closePayWindow() {
      if (opt.paymentWindow && !opt.paymentWindow.closed) {
        if (opt.managePaymentWindow) {
          opt.paymentWindow.close();
        } else {
          settings.log.info('payment window should be closed but client ' +
                            'is managing it');
        }
      }
    }

    settings.adapter.startTransaction({productId: productId},
                                      function(err, transData) {
      if (err) {
        closePayWindow();
        return onPurchase(err, partialProdInfo);
      }
      pay.processPayment(transData.productJWT, function(err) {
        if (err) {
          closePayWindow();
          return onPurchase(err, partialProdInfo);
        }

        // The payment flow has completed and the window has closed.
        // Wait for payment verification.

        waitForTransaction(
          transData,
          function(err, fullProductInfo) {
            onPurchase(err, fullProductInfo || partialProdInfo);
          }, {
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs
          }
        );
      }, {
        managePaymentWindow: opt.managePaymentWindow,
        paymentWindow: opt.paymentWindow,
      });
    });
  };


  exports.getProducts = function getProducts() {
    return products.all.apply(products, arguments);
  };


  //
  // private functions:
  //


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
      return cb(errors.PurchaseTimeout(
                        'timeout while waiting for completed transaction'));
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
