(function() {
  'use strict';

  var exports = fxpay.receipts = {};

  var errors = fxpay.getattr('errors');
  var API = fxpay.getattr('api').API;
  var products = fxpay.getattr('products');
  var settings = fxpay.getattr('settings');
  var utils = fxpay.getattr('utils');

  exports.all = function receipts_all(callback) {
    utils.getAppSelf(function(error, appSelf) {
      if (error) {
        return callback(error);
      }

      var nativeNum = 0;
      var receipts = [];
      if (appSelf && appSelf.receipts) {
        nativeNum = appSelf.receipts.length;
        receipts = Array.prototype.slice.call(appSelf.receipts);
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

      callback(null, receipts);
    });
  };


  exports.add = function receipts_add(receipt, onFinish) {
    utils.getAppSelf(function(error, appSelf) {
      if (error) {
        return onFinish(error);
      }
      if (appSelf && appSelf.addReceipt) {
        settings.log.info('adding receipt to device with addReceipt');
        return addReceiptNatively(receipt, onFinish);
      } else {
        settings.log.info('adding receipt to device with localStorage');
        return addReceiptWithLocStor(receipt, onFinish);
      }
    });
  };


  exports.validateAppReceipt = function(receipt, callback) {
    exports.verifyAppData(receipt, function(err, data, productInfo) {
      if (err) {
        return callback(err, productInfo);
      }

      verifyReceiptOnServer(receipt, data, productInfo,
                            function(err, productInfo) {
        if (err) {
          return callback(err, productInfo);
        }

        var selfOrigin = utils.getSelfOrigin();

        // Even though it's valid, make sure it's a receipt for our app.
        if (productInfo.productUrl !== selfOrigin) {
          return callback(errors.InvalidReceipt(
                            'valid receipt but wrong product; our origin: ' +
                            selfOrigin + '; receipt product origin: ' +
                            productInfo.productUrl), productInfo);
        }

        callback(null, productInfo);
      });
    });
  };


  exports.validateInAppProductReceipt = function(receipt, onRestore) {
    exports.verifyInAppProductData(receipt, function(err, data, productInfo) {
      if (err) {
        return onRestore(err, productInfo);
      }

      verifyReceiptOnServer(receipt, data, productInfo,
                            function(err, productInfo) {
        if (err) {
          return onRestore(err, productInfo);
        }
        var api = getApiFromReceipt(data);

        products.getById(productInfo.productId,
                         function(err, newProductInfo) {

          productInfo = productInfo || {};
          Object.keys(newProductInfo).forEach(function(attr) {
            productInfo[attr] = newProductInfo[attr];
          });
          if (err) {
            return onRestore(err, productInfo);
          }

          return onRestore(null, productInfo);
        }, {
          // If this is a test receipt, only fetch stub products.
          fetchStubs: data.typ === 'test-receipt',
          api: api,
        });
      });
    });
  };


  exports.verifyData = function(receipt, onVerify) {
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


  exports.verifyAppData = function(receipt, callback) {
    exports.verifyData(receipt, function(error, data, productInfo) {
      if (error) {
        return callback(error, data, productInfo);
      }

      utils.getAppSelf(function(error, appSelf) {
        if (error) {
          return callback(error, data, productInfo);
        }
        if (!appSelf) {
          return callback(errors.PayPlatformUnavailable(
                            'mozApps.getSelf() is needed to verify receipts'),
                            data, productInfo);
        }

        var manifest = appSelf.manifest;
        var allowAny;

        if (!manifest.installs_allowed_from) {
          // This is an unlikely case but let's guess that it implies "*".
          allowAny = true;
        } else {
          allowAny = manifest.installs_allowed_from.indexOf('*') !== -1;
        }
        if (allowAny) {
          settings.log.warn('your paid app manifest specifies ' +
                            'installs_allowed_from = ["*"] which means ' +
                            'an attacker can provide a spoofed receipt ' +
                            'validation service');
        }
        if (!allowAny &&
            manifest.installs_allowed_from.indexOf(data.iss) === -1) {
          return callback(errors.InvalidReceipt(
                'receipt issuer ' + data.iss + ' is not an allowed issuer; ' +
                'allowed: ' + manifest.installs_allowed_from),
                data, productInfo);
        }

        productInfo.productId = data.product.storedataObject.id;
        if (!productInfo.productId) {
          return callback(errors.InvalidReceipt(
                            'Could not find app productId in storedata:' +
                            data.product.storedata), data, productInfo);
        }

        callback(null, data, productInfo);
      });
    });
  };


  exports.verifyInAppProductData = function(receipt, callback) {
    exports.verifyData(receipt, function(error, data, productInfo) {
      if (error) {
        return callback(error, data, productInfo);
      }

      productInfo.productId = data.product.storedataObject.inapp_id;
      if (!productInfo.productId) {
        return callback(errors.InvalidReceipt(
                        'Could not find in-app productId in storedata: ' +
                        data.product.storedata), data, productInfo);
      }

      callback(null, data, productInfo);
    });
  };


  exports.checkStoreData = function(receipt) {
    // Return the storedata portion of the receipt without doing any
    // server validation. If the receipt is unparsable, returns null.
    var data = getReceiptData(receipt);
    if (!data) {
      return null;
    }
    return parseStoreData(data);
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
      var errCode = this.error.name;
      onFinish(errors.AddReceiptError(
                        'error calling app.addReceipt: ' + errCode,
                        {code: errCode}));
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
    var data = getReceiptData(receipt);
    if (!data) {
      return onVerify(new errors.InvalidReceipt('invalid JWT data'), {});
    }
    onVerify(null, data);
  }


  function verifyReceiptOnServer(receipt, data, productInfo, callback) {
    settings.log.debug('receipt data:', data);
    var api = getApiFromReceipt(data);

    settings.log.info('about to post to verifier URL', data.verify);

    api.post(data.verify, receipt, function(err, verifyResult) {
      productInfo.receiptInfo = verifyResult;

      if (err) {
        settings.log.error('Error verifying receipt:', err);
        return callback(err, productInfo);
      }

      settings.log.info('verification result:', verifyResult);

      if (verifyResult.status === 'ok') {
        settings.log.info('validated receipt for', productInfo);

        return callback(null, productInfo);

      } else {
        return callback(errors.InvalidReceipt(
                          'receipt ' + receipt.substring(0, 50) +
                           ' is invalid; service returned: ' +
                           verifyResult.status + ' ' + verifyResult.reason),
                        productInfo);
      }

    }, {contentType: 'text/plain'});
  }


  function verifyReceiptStoreData(data, onVerify) {
    var productInfo = {};

    if (!data.product) {
      return onVerify(errors.InvalidReceipt(
                        'receipt is missing the product field'),
                      productInfo);
    }

    if (!data.product.url) {
      return onVerify(errors.InvalidReceipt('receipt is missing product.url'),
                      productInfo);
    }

    if (!data.product.storedata) {
      return onVerify(
          errors.InvalidReceipt('receipt is missing product.storedata'),
          productInfo);
    }

    data.product.storedataObject = parseStoreData(data);
    if (!data.product.storedataObject) {
      return onVerify(errors.InvalidReceipt('missing storedata'), productInfo);
    }

    var isTestReceipt = (data.typ === 'test-receipt');

    if (isTestReceipt && !settings.allowTestReceipts) {
      return onVerify(errors.TestReceiptNotAllowed(
                'cannot restore test receipts when allowTestReceipts is false'),
                productInfo);
    }

    var productUrl = data.product.url;
    if (productUrl && !productUrl.match(/^(http(s)?|app):\/\/.*$/g)) {
      // Assume that un-prefixed product URLs are for packaged apps.
      // TODO: This seems wrong. Remove this when it's fixed in
      // Marketplace receipts: bug 1034264.
      productUrl = 'app://' + productUrl;
    }

    productInfo.productUrl = productUrl;

    if (!isTestReceipt) {
      // Make sure the receipt belongs only to this app.
      // In the future, it seems plausible that productUrl would
      // point to a specific path on the server rather than just the
      // origin. Instead of accounting for it, let's wait until that happens.
      var selfOrigin = utils.getSelfOrigin();
      if (productUrl !== selfOrigin) {
        return onVerify(errors.InvalidReceipt(
                          'app origin ' + selfOrigin +
                          ' does not match receipt product URL ' + productUrl),
                        productInfo);
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
      return onVerify(errors.InvalidReceipt(
                          'Receipt check URL ' + data.verify +
                          ' is not whitelisted. Valid choices: ' +
                          settings.receiptCheckSites),
                      data);
    }

    onVerify(null, data);
  }


  function getReceiptData(receipt) {
    var data;

    if (typeof receipt !== 'string') {
      settings.log.error('unexpected receipt type:', typeof receipt);
      return null;
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
      return null;
    }

    var jwtParts = data.split('.');
    if (jwtParts.length !== 3) {
      settings.log.error('wrong number of JWT segments in receipt:',
                         jwtParts.length);
      return null;
    }
    // Throw away the first and last JWT parts.
    data = jwtParts[1];

    try {
      data = base64urldecode(data);
    } catch (exc) {
      settings.log.error('error base64 decoding receipt:', exc.name,
                         exc.message);
      return null;
    }
    try {
      data = JSON.parse(data);
    } catch (exc) {
      settings.log.error('error parsing receipt JSON:', exc.name,
                         exc.message);
      return null;
    }

    return data;
  }


  function parseStoreData(receiptData) {
    if (!receiptData.product) {
      return null;
    }
    if (typeof receiptData.product.storedata !== 'string') {
      settings.log.error('unexpected storedata in receipt:',
                         receiptData.product.storedata);
      return null;
    }

    var params = {};
    receiptData.product.storedata.split('&').forEach(function(pair) {
      var parts = pair.split('=');
      params[parts[0]] = decodeURIComponent(parts[1]);
    });

    return params;
  }


  function getApiFromReceipt(receiptData) {
    // The issuer of the receipt is typically the Marketplace.
    // This is the site we want to use for making API requests.
    var apiUrlBase = receiptData.iss;
    settings.log.info('derived base API URL from receipt:', apiUrlBase);
    return new API(apiUrlBase);
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

})();
