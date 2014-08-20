(function(exports) {
  "use strict";

  var settings;
  var defaultSettings = {

    // Public settings.
    //
    // Disallow receipts belonging to other apps.
    allowAnyAppReceipt: false,
    apiUrlBase: 'https://marketplace.firefox.com',
    apiVersionPrefix: '/api/v1',
    // When truthy, this will override the API object's default.
    apiTimeoutMs: null,
    fakeProducts: false,
    // This object is used for all logging.
    log: window.console || {
      // Shim in a minimal set of the console API.
      debug: function() {},
      error: function() {},
      info: function() {},
      log: function() {},
      warn: function() {},
    },
    // Only these receipt check services are allowed.
    receiptCheckSites: ['https://receiptcheck.marketplace.firefox.com'],

    // Private settings.
    //
    // This will be the App object returned from mozApps.getSelf().
    appSelf: null,
    // Boolean flag to tell if we have addReceipt() or not.
    hasAddReceipt: null,
    onerror: function(err) {
      throw err;
    },
    oninit: function() {
      settings.log.info('initialization ran successfully');
    },
    onrestore: function(error, info) {
      if (error) {
        settings.log.error('error while restoring product:', info.productId,
                           'message:', error);
      } else {
        settings.log.info('product', info.productId,
                          'was restored from receipt');
      }
    },
    // A record of the initialization error, if there was one.
    initError: 'NOT_INITIALIZED',
    localStorage: window.localStorage || null,
    localStorageKey: 'fxpayReceipts',
    mozPay: navigator.mozPay || null,
    mozApps: navigator.mozApps || null,
  };


  exports.configure = function _configure(newSettings, opt) {
    opt = opt || {};
    if (opt.reset) {
      settings = {};
      for (var def in defaultSettings) {
        settings[def] = defaultSettings[def];
      }
    }
    for (var k in newSettings) {
      if (typeof settings[k] === 'undefined') {
        settings.log.error('configure() received an unknown setting:', k);
        return settings.onerror('INCORRECT_USAGE');
      }
      settings[k] = newSettings[k];
    }
    return settings;
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

    if (!settings.mozApps || !settings.mozApps.getSelf) {
      settings.log.error('Missing pay platform: mozApps was falsey');
      return storeError('PAY_PLATFORM_UNAVAILABLE');
    }

    var appRequest = settings.mozApps.getSelf();

    appRequest.onsuccess = function() {
      settings.appSelf = this.result;
      if (!settings.appSelf) {
        settings.log.error('falsey app object from getSelf()',
                           settings.appSelf);
        return storeError('NOT_INSTALLED_AS_APP');
      }

      settings.hasAddReceipt = !!settings.appSelf.addReceipt;

      if (!settings.hasAddReceipt && !settings.localStorage) {
        settings.log.error('no way to store receipts on this platform');
        return storeError('PAY_PLATFORM_UNAVAILABLE');
      }
      var numReceipts = 0;
      var receipt;
      var allReceipts = exports.getReceipts();
      for (var i = 0; i < allReceipts.length; i++) {
        receipt = allReceipts[i];
        settings.log.info('Installed receipt: ' + receipt);
        numReceipts++;
        exports.verifyReceipt(receipt, settings.onrestore);
      }
      settings.log.info('Number of receipts installed: ' + numReceipts);

      // Startup succeeded; clear the stored error.
      settings.initError = null;
      settings.oninit();
    };

    appRequest.onerror = function() {
      var err = this.error.name;
      settings.log.error('mozApps.getSelf() returned an error', err);
      storeError(err);
    };
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

    if (!settings.mozPay) {
      settings.log.error('Missing pay platform: mozPay was falsey');
      return onPurchase('PAY_PLATFORM_UNAVAILABLE', productInfo);
    }

    startPurchase(productId, onPurchase, opt);
  };


  exports.getReceipts = function _getReceipts() {
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


  exports.getProducts = function getProducts(onResult) {
    var products = [];
    if (settings.initError) {
      settings.log.error('init failed:', settings.initError);
      return onResult(settings.initError, products);
    }

    var api = new API(settings.apiUrlBase);
    var origin = encodeURIComponent(settings.appSelf.origin);
    var url;

    if (settings.fakeProducts) {
      settings.log.warn('about to fetch fake products');
      url = '/payments/stub-in-app-products/';
    } else {
      settings.log.info('about to fetch real products for app',
                        origin);
      url = '/payments/' + origin + '/in-app/';
    }

    api.get(url, function(err, result) {
      if (err) {
        return onResult(err, products);
      }
      settings.log.info('total products fetched:', result.objects.length);
      for (var i=0; i < result.objects.length; i++) {
        var ob = result.objects[i];
        var productInfo = {
          productId: ob.guid,
          name: ob.name,
          smallImageUrl: ob.logo_url
        };
        products.push(productInfo);
      }
      onResult(err, products);
    });
  };


  exports.verifyReceipt = function _verifyReceipt(receipt, onRestore) {
    exports.verifyReceiptData(receipt,
                              function(err, data,  productInfo) {
      if (err) {
        return onRestore(err, productInfo);
      }
      var api = new API(settings.apiUrlBase);
      settings.log.info('about to post to verifier URL', data.verify);
      api.post(data.verify, receipt, function(err, verifyResult) {
        if (err) {
          settings.log.error('Error verifying receipt:', err);
          return onRestore(err, productInfo);
        }
        settings.log.info('verification result:', verifyResult);

        if (verifyResult.status === 'ok') {
          settings.log.info('validated receipt for', productInfo);
          return onRestore(null, productInfo);
        } else {
          settings.log.error('receipt', receipt.substring(0, 10),
                             'is invalid; service returned:',
                             verifyResult.status, verifyResult.reason);
          return onRestore('INVALID_RECEIPT', productInfo);
        }
      }, {contentType: 'text/plain'});
    });
  };


  exports.verifyReceiptData = function _verifyReceiptData(receipt,
                                                          onVerify) {
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

    productInfo.productId = parseInt(params.inapp_id, 10);

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

    var buyingFakeProducts = (settings.fakeProducts &&
                              data.typ === 'test-receipt');

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


  function startPurchase(productId, onPurchase, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || undefined;
    opt.pollIntervalMs = opt.pollIntervalMs || undefined;

    var info = {productId: productId};
    var log = settings.log;
    var api = new API(settings.apiUrlBase);

    log.debug('starting purchase for product', productId);

    var path = "/webpay/inapp/prepare/";
    api.post(path, {inapp: productId}, function(err, productData) {
      if (err) {
        return onPurchase(err);
      }
      log.debug('xhr load: JSON', productData);

      var payReq = settings.mozPay([productData.webpayJWT]);

      payReq.onerror = function() {
        log.error('mozPay: received onerror():', this.error.name);
        onPurchase(this.error.name, info);
      };

      payReq.onsuccess = function() {
        log.debug('mozPay: received onsuccess()');
        // The payment flow has closed. Let's wait for
        // payment verification.

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
      };
    });
  }


  function onTransaction(err, onPurchase, data, info) {
    if (err) {
      return onPurchase(err, info);
    }
    settings.log.info('received completed transaction:', data);

    addReceipt(data.receipt, function(err) {
      onPurchase(err, info);
    });
  }


  function addReceipt(receipt, onFinish) {
    if (settings.hasAddReceipt) {
      settings.log.info('adding receipt to device with addReceipt');
      return addReceiptNatively(receipt, onFinish);
    } else {
      settings.log.info('adding receipt to device with localStorage');
      return addReceiptWithLocStor(receipt, onFinish);
    }
  }


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


  function API(baseUrl, opt) {
    opt = opt || {};
    this.baseUrl = baseUrl;
    this.log = settings.log;
    this.timeoutMs = settings.apiTimeoutMs || 10000;
    this.versionPrefix = settings.apiVersionPrefix || undefined;
  }

  exports.API = API;

  API.prototype.url = function(path, opt) {
    opt = opt || {};
    opt.versioned = (typeof opt.versioned !== 'undefined'
                     ? opt.versioned: true);
    var url = this.baseUrl;
    if (opt.versioned) {
      url += (this.versionPrefix || '');
    }
    url += path;
    return url;
  };

  API.prototype.request = function(method, path, data, cb, opt) {
    opt = opt || {};
    var defaultCType = (data ? 'application/x-www-form-urlencoded': null);
    opt.contentType = opt.contentType || defaultCType;
    var defaultHeaders = {
      'Accept': 'application/json'
    };
    if (opt.contentType) {
      defaultHeaders['Content-Type'] = opt.contentType;
    }
    opt.headers = opt.headers || defaultHeaders;

    var log = this.log;
    var api = this;
    var url;
    if (!cb) {
      cb = function(err, data) {
        if (err) {
          throw err;
        }
        log.info('default callback received data:', data);
      };
    }
    if (/^http(s)?:\/\/.*/.test(path)) {
      // Requesting an absolute URL so no need to prefix it.
      url = path;
    } else {
      url = this.url(path);
    }
    var xhr = new XMLHttpRequest({mozSystem: true});
    // This doesn't seem to be supported by sinon yet.
    //xhr.responseType = "json";

    var events = {
      abort: function() {
        log.error('xhr abort: path:', path);
        cb('API_REQUEST_ABORTED');
      },
      error: function(evt) {
        log.error('xhr error: ', evt, 'path:', path);
        cb('API_REQUEST_ERROR');
      },
      load: function() {
        var data;
        if (this.status.toString().slice(0, 1) !== '2') {
          // TODO: handle status === 0 ?
          // TODO: handle redirects.
          var code = 'BAD_API_RESPONSE';
          log.error(code, 'status:', this.status, 'for URL:', url);
          log.debug(code, 'response:', this.responseText);
          return cb('BAD_API_RESPONSE');
        }

        log.debug('xhr load: GOT', this.responseText);
        try {
          // TODO: be smarter about content-types here.
          data = JSON.parse(this.responseText);
        } catch (parseErr) {
          var code = 'BAD_JSON_RESPONSE';
          log.error(code, 'for URL:', url,
                    'exception', parseErr,
                    'response:', this.responseText);
          return cb(code);
        }

        cb(null, data);
      },
      timeout: function() {
        log.error('xhr request to', url, 'timed out after',
                  api.timeoutMs, 'ms');
        cb('API_REQUEST_TIMEOUT');
      }
    };

    for (var k in events) {
      xhr.addEventListener(k, events[k], false);
    }

    log.debug('opening', method, 'to', url);
    xhr.timeout = api.timeoutMs;
    xhr.open(method, url, true);

    for (var hdr in opt.headers) {
      xhr.setRequestHeader(hdr, opt.headers[hdr]);
    }
    if (opt.contentType === 'application/x-www-form-urlencoded' && data) {
      data = serialize(data);
    }
    xhr.send(data);
  };

  API.prototype.get = function(path, cb, opt) {
    this.request('GET', path, null, cb, opt);
  };

  API.prototype.del = function(path, cb, opt) {
    this.request('DELETE', path, null, cb, opt);
  };

  API.prototype.post = function(path, data, cb, opt) {
    this.request('POST', path, data, cb, opt);
  };

  API.prototype.put = function(path, data, cb, opt) {
    this.request('PUT', path, data, cb, opt);
  };

  function serialize(obj) {
    // {"foo": "bar", "baz": "zup"} -> "foo=bar&baz=zup"
    var str = [];
    for (var p in obj){
      if (obj.hasOwnProperty(p)) {
        str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
      }
    }
    return str.join("&");
  }

})(typeof exports === 'undefined' ? (this.fxpay = {}): exports);
