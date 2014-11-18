if (typeof window.fxpay === 'undefined') {
  window.fxpay = {};
}
if (typeof window.fxpay.receipts === 'undefined') {
  window.fxpay.receipts = {};
}

(function(exports) {
  "use strict";

  var API = require('fxpay/api').API;
  var products = require('fxpay/products');
  var settings = require('fxpay/settings');

  exports.all = function receipts_all() {
    var nativeNum = 0;
    var receipts = [];
    if (settings.appSelf && settings.appSelf.receipts) {
      nativeNum = settings.appSelf.receipts.length;
      receipts = Array.prototype.slice.call(settings.appSelf.receipts);
    }

    var locNum = 0;
    var storedReceipts = settings.localStorage.getItem(
      settings.localStorageKey);

    if (storedReceipts) {
      storedReceipts = JSON.parse(storedReceipts);
      for (var j = 0; j < storedReceipts.length; j++) {
        if (receipts.indexOf(storedReceipts[j]) === -1) {
          receipts.push(storedReceipts[j]);
          locNum++;
        } else {
          settings.log.info(
            'ignoring dupe receipt fetched from local storage',
            storedReceipts[j].substring(0, 5));
        }
      }
    }

    settings.log.info('receipts fetched from mozApps:', nativeNum);
    settings.log.info('receipts fetched from localStorage:', locNum);

    return receipts;
  };


  exports.add = function receipts_add(receipt, onFinish) {
    if (settings.hasAddReceipt) {
      settings.log.info('adding receipt to device with addReceipt');
      return addReceiptNatively(receipt, onFinish);
    } else {
      settings.log.info('adding receipt to device with localStorage');
      return addReceiptWithLocStor(receipt, onFinish);
    }
  };


  exports.verify = function receipts_verify(receipt, onRestore) {
    exports.verifyData(receipt,
                       function(err, data,  productInfo) {
      if (err) {
        return onRestore(err, productInfo);
      }
      // The issuer of the receipt is the site of the Marketplace.
      // This is the site we want to use for making API requests.
      var apiUrlBase = data.iss;
      settings.log.info('derived base API URL from receipt:', apiUrlBase);
      var api = new API(apiUrlBase);

      settings.log.info('about to post to verifier URL', data.verify);
      api.post(data.verify, receipt, function(err, verifyResult) {
        if (err) {
          settings.log.error('Error verifying receipt:', err);
          return onRestore(err, productInfo);
        }
        settings.log.info('verification result:', verifyResult);

        if (verifyResult.status === 'ok') {
          settings.log.info('validated receipt for', productInfo);

          products.getById(productInfo.productId,
                           function(err, newProductInfo) {
            if (err) {
              return onRestore(err, productInfo);
            }
            return onRestore(null, newProductInfo);
          }, {
            // If this is a test receipt, only fetch stub products.
            fetchStubs: data.typ === 'test-receipt',
            api: api
          });

        } else {
          settings.log.error('receipt', receipt.substring(0, 10),
                             'is invalid; service returned:',
                             verifyResult.status, verifyResult.reason);
          return onRestore('INVALID_RECEIPT', productInfo);
        }
      }, {contentType: 'text/plain'});
    });
  };


  exports.verifyData = function receipts_verifyData(receipt, onVerify) {
    verifyReceiptJwt(receipt, function(err, data) {
      if (err) {
        return onVerify(err, data, {});
      }

      verifyReceiptStoreData(data, function(err, productInfo) {
        if (err) {
          return onVerify(err, data, productInfo);
        }

        verifyReceiptCheckUrl(data, function(err) {
          if (err) {
            return onVerify(err, data, productInfo);
          }

          onVerify(null, data, productInfo);
        });
      });
    });
  };

  //
  // private functions:
  //


  function addReceiptNatively(receipt, onFinish) {
    var receiptReq = settings.appSelf.addReceipt(receipt);

    receiptReq.onsuccess = function() {
      settings.log.info('item fully purchased and receipt installed');
      onFinish(null);
    };

    receiptReq.onerror = function() {
      var err = this.error.name;
      settings.log.error('error calling app.addReceipt', err);
      onFinish(err);
    };
  }


  function addReceiptWithLocStor(receipt, onFinish) {
    var allReceipts = settings.localStorage.getItem(settings.localStorageKey);
    if (allReceipts) {
      allReceipts = JSON.parse(allReceipts);
    } else {
      allReceipts = [];
    }
    if (allReceipts.indexOf(receipt) === -1) {
      allReceipts.push(receipt);
    } else {
      settings.log.info('not adding receipt', receipt.substring(0, 5),
                        'because it has already been added');
    }
    settings.localStorage.setItem(settings.localStorageKey,
                                  JSON.stringify(allReceipts));

    onFinish(null);
  }

  function verifyReceiptJwt(receipt, onVerify) {
    var data = {};

    if (typeof receipt !== 'string') {
      settings.log.error('unexpected receipt type:', typeof receipt);
      return onVerify('INVALID_RECEIPT', data);
    }

    var majorParts = receipt.split('~');
    if (majorParts.length === 1) {
      data = majorParts[0];
    } else if (majorParts.length === 2) {
      // Ignore the preceding json key.
      data = majorParts[1];
    } else {
      settings.log.error('wrong number of tilde separated ' +
                         'segments in receipt');
      return onVerify('INVALID_RECEIPT', data);
    }

    var jwtParts = data.split('.');
    if (jwtParts.length !== 3) {
      settings.log.error('wrong number of JWT segments in receipt:',
                         jwtParts.length);
      return onVerify('INVALID_RECEIPT', data);
    }
    // Throw away the first and last JWT parts.
    data = jwtParts[1];

    try {
      data = base64urldecode(data);
    } catch (exc) {
      settings.log.error('error base64 decoding receipt:', exc.name,
                         exc.message);
      return onVerify('INVALID_RECEIPT', data);
    }
    try {
      data = JSON.parse(data);
    } catch (exc) {
      settings.log.error('error parsing receipt JSON:', exc.name,
                         exc.message);
      return onVerify('INVALID_RECEIPT', data);
    }

    return onVerify(null, data);
  }


  function verifyReceiptStoreData(data, onVerify) {
    var productInfo = {};

    if (!data.product) {
      settings.log.error('receipt is missing the product field');
      return onVerify('INVALID_RECEIPT', productInfo);
    }

    if (!data.product.url) {
      settings.log.error('receipt is missing product.url');
      return onVerify('INVALID_RECEIPT', productInfo);
    }

    if (!data.product.storedata) {
      settings.log.error('receipt is missing product.storedata');
      return onVerify('INVALID_RECEIPT', productInfo);
    }

    if (typeof data.product.storedata !== 'string') {
      settings.log.error('unexpected storedata in receipt:',
                         data.product.storedata);
      return onVerify('INVALID_RECEIPT', productInfo);
    }

    var params = {};
    data.product.storedata.split('&').forEach(function (pair) {
      var parts = pair.split('=');
      params[parts[0]] = decodeURIComponent(parts[1]);
    });

    productInfo.productId = params.inapp_id;

    if (!productInfo.productId) {
      settings.log.error('Could not find productId in storedata:',
                         data.product.storedata);
      return onVerify('INVALID_RECEIPT', productInfo);
    }

    var productUrl = data.product.url;
    if (productUrl && !productUrl.match(/^(http(s)?|app):\/\/.*$/g)) {
      // Assume that un-prefixed product URLs are for packaged apps.
      // TODO: This seems wrong. Remove this when it's fixed in
      // Marketplace receipts: bug 1034264.
      productUrl = 'app://' + productUrl;
    }

    productInfo.productUrl = productUrl;

    var isTestReceipt = (data.typ === 'test-receipt');

    if (isTestReceipt && !settings.fakeProducts) {
      settings.log.error(
        'cannot restore test receipts when fakeProducts ' +
        'is false');
      return onVerify('TEST_RECEIPT_NOT_ALLOWED', productInfo);
    }

    var buyingFakeProducts = (settings.fakeProducts && isTestReceipt);

    if (!settings.allowAnyAppReceipt && !buyingFakeProducts) {
      // Make sure the receipt belongs only to this app.
      if (productUrl !== settings.appSelf.origin) {
        settings.log.error('app origin', settings.appSelf.origin,
                           'does not match receipt product URL', productUrl);
        return onVerify('INVALID_RECEIPT', productInfo);
      }
    }

    onVerify(null, productInfo);
  }


  function verifyReceiptCheckUrl(data, onVerify) {

    // Make sure the receipt check URL is in the whitelist so we
    // don't give away free products.
    var urlOk = false;
    var verifyUrl = data.verify || '';
    for (var i = 0; i < settings.receiptCheckSites.length; i++) {
      var domain = settings.receiptCheckSites[i];
      if (verifyUrl.indexOf(domain) === 0) {
        urlOk = true;
        break;
      }
    }
    if (!urlOk) {
      settings.log.error('Receipt check URL', data.verify,
                         'is not whitelisted. Valid choices:',
                         settings.receiptCheckSites);
      return onVerify('INVALID_RECEIPT', data);
    }

    onVerify(null, data);
  }


  function base64urldecode(s) {
    s = s.replace(/-/g, '+'); // 62nd char of encoding
    s = s.replace(/_/g, '/'); // 63rd char of encoding
    switch (s.length % 4) { // Pad with trailing '='s
    case 0:
      break; // No pad chars in this case
    case 1:
      s += "===";
      break;
    case 2:
      s += "==";
      break;
    case 3:
      s += "=";
      break;
    default:
      throw "Illegal base64url string!";
    }
    return atob(s);
  }

})(window.fxpay.receipts);
