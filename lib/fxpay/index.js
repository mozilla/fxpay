(function() {
  'use strict';

  var exports = window.fxpay.utils.namespace('fxpay');

  var API = require('fxpay/api').API;
  var pay = require('fxpay/pay');
  var settings = require('fxpay/settings');
  var products = require('fxpay/products');
  var receipts = require('fxpay/receipts');

  //
  // publicly exported functions:
  //


  exports.configure = function() {
    settings.configure.apply(settings, arguments);
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

      if (!settings.hasAddReceipt && !settings.localStorage) {
        settings.log.error('no way to store receipts on this platform');
        return storeError('PAY_PLATFORM_UNAVAILABLE');
      }
      var numReceipts = 0;
      var receipt;
      var allReceipts = receipts.all();
      for (var i = 0; i < allReceipts.length; i++) {
        receipt = allReceipts[i];
        settings.log.info('Installed receipt: ' + receipt);
        numReceipts++;
        receipts.verify(receipt, settings.onrestore);
      }
      settings.log.info('Number of receipts installed: ' + numReceipts);

      // Startup succeeded; clear the stored error.
      settings.initError = null;
      settings.oninit();
    });
  };


  exports.purchase = function _purchase(productId, onPurchase, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || undefined;
    opt.pollIntervalMs = opt.pollIntervalMs || undefined;
    var productInfo = {};

    if (!onPurchase) {
      onPurchase = function _onPurchase(err, info) {
        if (err) {
          throw err;
        }
        console.log('product', info.productId, 'purchased');
      };
    }

    if (settings.initError) {
      settings.log.error('init failed:', settings.initError);
      return onPurchase(settings.initError, productInfo);
    }

    startPurchase(productId, onPurchase, opt);
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


  function startPurchase(productId, onPurchase, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || undefined;
    opt.pollIntervalMs = opt.pollIntervalMs || undefined;

    var info = {productId: productId};
    var log = settings.log;
    var api = new API(settings.apiUrlBase);

    log.debug('starting purchase for product', productId);

    api.post(settings.prepareJwtApiUrl, {inapp: productId},
             function(err, productData) {
      if (err) {
        return onPurchase(err, info);
      }
      log.debug('requested JWT for ', productId, 'from API; got:',
                productData);

      pay.processPayment([productData.webpayJWT], function(err) {
        if (err) {
          return onPurchase(err, info);
        }

        // The payment flow has completed. Wait for payment verification.

        getTransactionResult(
          api, api.url(
            productData.contribStatusURL,
            {versioned: false}
          ), function(err, data) {
            onTransaction(err, onPurchase, data, info);
          }, {
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs
          }
        );
      });
    });
  }


  function onTransaction(err, onPurchase, data, productInfo) {
    if (err) {
      return onPurchase(err, productInfo);
    }
    settings.log.info('received completed transaction:', data);

    receipts.add(data.receipt, function(err) {
      if (err) {
        return onPurchase(err, productInfo);
      }
      products.getById(productInfo.productId,
                       function(err, fullProductInfo) {
        if (err) {
          return onPurchase(err, fullProductInfo);
        }
        onPurchase(null, fullProductInfo);
      }, {
        // If this is a purchase for fake products, only fetch stub products.
        fetchStubs: settings.fakeProducts
      });
    });
  }


  // NOTE: if you change this function signature, change the setTimeout below.
  function getTransactionResult(api, transStatusPath, cb, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || 10;
    opt.pollIntervalMs = opt.pollIntervalMs || 1000;
    opt._tries = opt._tries || 1;

    var log = settings.log;
    log.debug('Getting transaction state at', transStatusPath,
              'tries=', opt._tries);

    if (opt._tries > opt.maxTries) {
      log.error('Giving up on transaction at', transStatusPath,
                'after', opt._tries, 'tries');
      return cb('TRANSACTION_TIMEOUT');
    }

    api.get(transStatusPath, function(err, data) {
      if (err) {
        return cb(err);
      }

      if (data.status === 'complete') {
        return cb(null, data);
      } else if (data.status === 'incomplete') {
        log.debug('Re-trying incomplete transaction in',
                  opt.pollIntervalMs, 'ms');
        window.setTimeout(function() {
          getTransactionResult(api, transStatusPath, cb, {
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs,
            _tries: opt._tries + 1
          });
        }, opt.pollIntervalMs);
      } else {
        log.error('transaction status', data.status, 'from',
                  transStatusPath, 'was unexpected');
        return cb('INVALID_TRANSACTION_STATE');
      }
    });
  }

})();
