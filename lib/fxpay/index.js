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
    utils.logDeprecation(
      'fxpay.init() is no longer supported; use ' +
      'fxpay.getProducts()...product.validateReceipt() instead', '0.0.15');

    fxpay.getProducts()
      .then(function(products) {
        products.forEach(function(product) {

          if (product.hasReceipt()) {
            product.validateReceipt().then(function(productInfo) {
              settings.onrestore(null, productInfo);
            }).catch(function(error) {
              settings.onrestore(error, error.productInfo);
            });
          }

        });
      })
      .then(settings.oninit)
      .catch(settings.onerror);

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


  exports.purchase = function _purchase(productId) {
    settings.initialize();
    var callback;
    var opt;

    if (typeof arguments[1] === 'function') {
      // Old style: fxpay.purchase(productId, callback, opt)
      callback = arguments[1];
      opt = arguments[2];
    } else {
      // New style: fxpay.purchase(productId, opt);
      opt = arguments[1];
    }

    opt = utils.defaults(opt, {
      maxTries: undefined,
      managePaymentWindow: undefined,
      paymentWindow: undefined,
      pollIntervalMs: undefined,
    });

    settings.initialize();

    var promise = new Promise(function(resolve, reject) {
      if (typeof opt.managePaymentWindow === 'undefined') {
        // By default, do not manage the payment window when a custom
        // window is defined. This means the client must close its own window.
        opt.managePaymentWindow = !opt.paymentWindow;
      }

      var partialProdInfo = new products.Product({productId: productId});
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
          err.productInfo = partialProdInfo;
          return reject(err);
        }
        pay.processPayment(transData.productJWT, function(err) {
          if (err) {
            closePayWindow();
            err.productInfo = partialProdInfo;
            return reject(err);
          }

          // The payment flow has completed and the window has closed.
          // Wait for payment verification.

          waitForTransaction(
            transData,
            function(err, fullProductInfo) {
              if (err) {
                err.productInfo = partialProdInfo;
                reject(err);
              } else {
                resolve(fullProductInfo);
              }
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
    });

    if (callback) {
      utils.logDeprecation(
        'purchase(id, callback) is no longer supported; use the returned ' +
        'promise instead', '0.0.15');
      promise.then(function(productInfo) {
        callback(null, productInfo);
      }).catch(function(error) {
        callback(error, error.productInfo || new products.Product());
      });
    }

    return promise;
  };


  exports.getProduct = function getProduct() {
    settings.initialize();
    return products.get.apply(products, arguments);
  };


  exports.getProducts = function getProducts() {
    settings.initialize();
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
