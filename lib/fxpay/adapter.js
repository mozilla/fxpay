(function() {
  'use strict';

  var exports = fxpay.adapter = {};

  var API = fxpay.getattr('api').API;
  var products = fxpay.getattr('products');
  var receipts = fxpay.getattr('receipts');
  var settings = fxpay.getattr('settings');
  var utils = fxpay.getattr('utils');


  function FxInappAdapter() {
    //
    // Adapter for Firefox Marketplace in-app products.
    //
    // This implements the backend details about how a
    // purchase JWT is generated and it has some hooks for
    // initialization and finishing up purchases.
    //
    // This is the default adapter and serves as a guide
    // for what public methods you need to implement if you
    // were to create your own.
    //
    settings.log.info('using Firefox Marketplace In-App adapter');
    this.api = new API(settings.apiUrlBase);
  }

  FxInappAdapter.prototype.init = function(callback) {
    //
    // Initialize the payment system.
    //
    // This is called when the fxpay library itself is initialized.
    // This is a chance to restore purchases or anything that should
    // happen when an app starts up.
    //
    // This must execute callback(error) when finished.
    // The error parameter should be null when there are no errors.
    //
    if (!settings.hasAddReceipt && !settings.localStorage) {
      settings.log.error('no way to store receipts on this platform');
      return callback('PAY_PLATFORM_UNAVAILABLE');
    }
    if (settings.appSelf &&
        settings.window.location.href.indexOf('app://') === 0 &&
        !settings.appSelf.manifest.origin) {
      settings.log.error('packaged app did not define an origin so ' +
                         'we have no key to look up products');
      return callback('UNDEFINED_APP_ORIGIN');
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
    callback();
  };

  FxInappAdapter.prototype.startTransaction = function(opt, callback) {
    //
    // Start a transaction.
    //
    // The `opt` object contains the following parameters:
    //
    // - productId: the ID of the product purchased.
    //
    // When finished, execute callback(error, transactionData).
    //
    // - error: an error if one occurred or null if not
    // - transactionData: an object that describes the transaction.
    //   This can be specific to your adapter but must include
    //   the `productJWT` parameter which is a JSON Web Token
    //   that can be passed to navigator.mozPay().
    //
    opt = utils.defaults(opt, {
      productId: null
    });
    var self = this;
    self.api.post(settings.prepareJwtApiUrl, {inapp: opt.productId},
                  function(err, productData) {
      if (err) {
        return callback(err);
      }
      settings.log.debug('requested JWT for ', opt.productId, 'from API; got:',
                         productData);
      return callback(null, {productJWT: productData.webpayJWT,
                             productId: opt.productId,
                             productData: productData});
    });
  };

  FxInappAdapter.prototype.transactionStatus = function(transData, callback) {
    //
    // Get the status of a transaction.
    //
    // The `transData` object received is the same one returned by
    // startTransaction().
    //
    // When finished, execute callback(error, isCompleted, productInfo).
    //
    // - error: an error if one occurred or null if not.
    // - isCompleted: true or false if the transaction has been
    //   completed successfully.
    // - productInfo: an object that describes the product purchased.
    //   If there was an error or the transaction was not completed,
    //   this can be null.
    //   A productInfo object should have the propeties described at:
    //
    //   https://developer.mozilla.org/en-US/Marketplace/Monetization
    //   /In-app_payments_section/fxPay_iap#Product_Info_Object
    //
    var self = this;

    var url = self.api.url(transData.productData.contribStatusURL,
                           {versioned: false});
    self.api.get(url, function(err, data) {
      if (err) {
        return callback(err);
      }
      if (data.status === 'complete') {
        self._finishTransaction(data, transData.productId,
                                function(err, productInfo) {
          if (err) {
            return callback(err);
          }
          callback(null, true, productInfo);
        });
      } else if (data.status === 'incomplete') {
        return callback(null, false);
      } else {
        settings.log.error('transaction status', data.status, 'from',
                           url, 'was unexpected');
        return callback('INVALID_TRANSACTION_STATE');
      }
    });
  };

  FxInappAdapter.prototype._finishTransaction = function(data, productId,
                                                         callback) {
    //
    // Private helper method to finish transactionStatus().
    //
    settings.log.info('received completed transaction:', data);

    receipts.add(data.receipt, function(err) {
      if (err) {
        return callback(err);
      }
      products.getById(productId, function(err, fullProductInfo) {
        if (err) {
          return callback(err, fullProductInfo);
        }
        callback(null, fullProductInfo);
      }, {
        // If this is a purchase for fake products, only fetch stub products.
        fetchStubs: settings.fakeProducts
      });
    });
  };


  exports.FxInappAdapter = FxInappAdapter;

})();
