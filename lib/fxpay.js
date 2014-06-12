(function(exports) {
  "use strict";

  var settings = {

    // Public settings.
    //
    apiUrlBase: 'https://marketplace.firefox.com',
    // When defined, this will override the API object's default.
    apiTimeoutMs: undefined,
    apiVersionPrefix: '/api/v1',
    log: window.console,

    // Private settings.
    //
    // This will be the App object returned from mozApps.getSelf().
    appSelf: null,
    callbacks: {
      onerror: function(err) {
        throw err;
      },
      oninit: function() {
        settings.log('all products set up successfully');
      }
    },
    // A copy of a setup error for later retrieval.
    initError: 'NOT_INITIALIZED',
    mozPay: navigator.mozPay,
    mozApps: navigator.mozApps,
  };


  exports.configure = function _configure(newSettings) {
    for (var k in newSettings) {
      settings[k] = newSettings[k];
    }
  };


  exports.init = function _init(opt) {
    opt = opt || {};

    function storeError(err) {
      settings.initError = err;
      return settings.callbacks.onerror(settings.initError);
    }

    if (opt.onerror) {
      settings.callbacks.onerror = opt.onerror;
    }
    if (opt.oninit) {
      settings.callbacks.oninit = opt.oninit;
    }

    var validOptions = ['onerror', 'oninit'];
    for (var k in opt) {
      if (validOptions.indexOf(k) === -1) {
        settings.log.error('init() received an unknown option:', k);
        return settings.callbacks.onerror('INCORRECT_USAGE');
      }
    }

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
      if (!settings.appSelf.addReceipt) {
        // addReceipt() is a newer API call but we need it for
        // in-app product ownership.
        settings.log.error('method App.addReceipt does not exist');
        return storeError('PAY_PLATFORM_UNAVAILABLE');
      }
      var numReceipts = 0;
      if (settings.appSelf.receipts) {
        for (var i = 0; i < settings.appSelf.receipts.length; i++) {
          settings.log.info('Installed receipt: ' +
                            settings.appSelf.receipts[i]);
          numReceipts++;
        }
      }
      settings.log.info('Number of receipts already installed: ' + numReceipts);

      // Startup succeeded; clear the stored error.
      settings.initError = null;
      settings.callbacks.oninit();
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
      return onPurchase(settings.initError);
    }

    if (!settings.mozPay) {
      settings.log.error('Missing pay platform: mozPay was falsey');
      return onPurchase('PAY_PLATFORM_UNAVAILABLE');
    }

    startPurchase(productId, onPurchase, settings.appSelf, opt);
  };


  function startPurchase(productId, onPurchase, appSelf, opt) {
    opt = opt || {};
    opt.maxTries = opt.maxTries || undefined;
    opt.pollIntervalMs = opt.pollIntervalMs || undefined;

    var info = {productId: productId,
                newPurchase: true};
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
        onPurchase(this.error.name);
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
            onTransaction(err, onPurchase, data, appSelf, info);
          }, {
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs
          }
        );
      };
    });
  }


  function onTransaction(err, onPurchase, data, appSelf, info) {
    if (err) {
      return onPurchase(err);
    }
    settings.log.info('received completed transaction:', data);

    settings.log.info('adding receipt to device');
    var receiptReq = appSelf.addReceipt(data.receipt);

    receiptReq.onsuccess = function() {
      settings.log.info('item fully purchased and receipt installed');
      onPurchase(null, info);
    };

    receiptReq.onerror = function() {
      var err = this.error.name;
      settings.log.error('error calling app.addReceipt', err);
      onPurchase(err);
    };
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
