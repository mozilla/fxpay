(function(exports) {
  "use strict";

  exports.purchase = function _purchase(productId, opt) {
    opt = opt || {};
    opt.onpurchase = opt.onpurchase || function(err) {
      if (err) {
        throw err;
      }
    };
    opt.oncheckpayment = opt.oncheckpayment || function() {};
    opt.log = opt.log || window.console;
    opt.mozApps = opt.mozApps || navigator.mozApps;
    opt.mozPay = opt.mozPay || navigator.mozPay;
    opt.maxTries = opt.maxTries || undefined;
    opt.pollIntervalMs = opt.pollIntervalMs || undefined;
    opt.apiTimeoutMs = opt.apiTimeoutMs || undefined;
    opt.apiUrlBase = (opt.apiUrlBase ||
                      'https://marketplace.firefox.com');
    opt.apiVersionPrefix = (opt.apiVersionPrefix || '/api/v1');

    if (!opt.mozApps.getSelf) {
      opt.log.error('Missing pay platform: mozApps.getSelf was falsey');
      return opt.onpurchase('PAY_PLATFORM_UNAVAILABLE');
    }

    if (!opt.mozPay) {
      opt.log.error('Missing pay platform: mozPay was falsey');
      return opt.onpurchase('PAY_PLATFORM_UNAVAILABLE');
    }

    var appRequest = opt.mozApps.getSelf();

    appRequest.onsuccess = function() {
      var appSelf = this.result;
      if (!appSelf) {
        opt.log.error('falsey app object from getSelf()', appSelf);
        return opt.onpurchase('NOT_INSTALLED_AS_APP');
      }
      if (!appSelf.addReceipt) {
        // addReceipt() is a newer API call but we need it for
        // in-app product ownership.
        opt.log.error('method App.addReceipt does not exist');
        return opt.onpurchase('PAY_PLATFORM_UNAVAILABLE');
      }
      startPurchase(productId, appSelf, opt);
    };

    appRequest.onerror = function() {
      var err = this.error.name;
      opt.log.error('mozApps.getSelf() returned an error', err);
      opt.onpurchase(err);
    };
  };


  function startPurchase(productId, appSelf, opt) {
    opt = opt || {};
    opt.log = opt.log || window.console;

    var log = opt.log;
    var api = new API(opt.apiUrlBase,
                      {log: log,
                       timeoutMs: opt.apiTimeoutMs,
                       versionPrefix: opt.apiVersionPrefix});

    log.debug('starting purchase for product', productId);

    var path = "/webpay/inapp/prepare/";
    api.post(path, {inapp: productId}, function(err, productData) {
      if (err) {
        return opt.onpurchase(err);
      }
      log.debug('xhr load: JSON', productData);

      var payReq = opt.mozPay([productData.webpayJWT]);

      payReq.onerror = function() {
        log.error('mozPay: received onerror():', this.error.name);
        opt.onpurchase(this.error.name);
      };

      payReq.onsuccess = function() {
        log.debug('mozPay: received onsuccess()');
        // The payment flow has closed. Let's wait for
        // payment verification.
        opt.oncheckpayment();

        getTransactionResult(
          api, api.url(
            productData.contribStatusURL,
            {versioned: false}
          ), function(err, data) {
            onTransaction(err, data, appSelf, opt);
          }, {
            log: log,
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs
          }
        );
      };
    });
  }


  function onTransaction(err, data, appSelf, opt) {
    if (err) {
      return opt.onpurchase(err);
    }
    opt.log.info('received completed transaction:', data);

    opt.log.info('adding receipt to device');
    var receiptReq = appSelf.addReceipt(data.receipt);

    receiptReq.onsuccess = function() {
      opt.log.info('item fully purchased and receipt installed');
      opt.onpurchase(null);
    };

    receiptReq.onerror = function() {
      var err = this.error.name;
      opt.log.error('error calling app.addReceipt', err);
      opt.onpurchase(err);
    };
  }


  // NOTE: if you change this function signature, change the setTimeout below.
  function getTransactionResult(api, transStatusPath, cb, opt) {
    opt = opt || {};
    opt.log = opt.log || window.console;
    opt.maxTries = opt.maxTries || 10;
    opt.pollIntervalMs = opt.pollIntervalMs || 1000;
    opt._tries = opt._tries || 1;

    var log = opt.log;
    log.debug('Getting transaction state at', transStatusPath,
              'tries=', opt._tries);

    if (opt._tries > opt.maxTries) {
      log.error('Giving up on transaction at', transStatusPath,
                'after', opt._tries, 'tries');
      return cb('TRANSACTION_TIMEOUT');
    }

    // TODO: get or post?
    api.post(transStatusPath, null, function(err, data) {
      if (err) {
        return cb(err);
      }

      // TODO: make sure these state values are realistic.
      if (data.state === 'COMPLETED') {
        // The transaction is complete.
        return cb(null, data);
      } else if (data.state === 'PENDING') {
        log.debug('Re-trying pending transaction in',
                  opt.pollIntervalMs, 'ms');
        window.setTimeout(function() {
          getTransactionResult(api, transStatusPath, cb, {
            log: log,
            maxTries: opt.maxTries,
            pollIntervalMs: opt.pollIntervalMs,
            _tries: opt._tries + 1
          });
        }, opt.pollIntervalMs);
      } else {
        log.error('transaction state', data.state, 'from',
                  api.url(transStatusPath), 'was unexpected');
        return cb('INVALID_TRANSACTION_STATE');
      }
    });
  }


  function API(baseUrl, opt) {
    opt = opt || {};
    this.baseUrl = baseUrl;
    this.log = opt.log || window.console;
    this.timeoutMs = opt.timeoutMs || 5000;
    this.versionPrefix = opt.versionPrefix || undefined;
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

  API.prototype.request = function(method, path, data, cb) {
    var log = this.log;
    var api = this;
    var url;
    if (/^http(s):\/\/.*/.test(path)) {
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
    xhr.send(serialize(data));
  };

  API.prototype.get = function(path, cb) {
    this.request('GET', path, null, cb);
  };

  API.prototype.del = function(path, cb) {
    this.request('DELETE', path, null, cb);
  };

  API.prototype.post = function(path, data, cb) {
    this.request('POST', path, data, cb);
  };

  API.prototype.put = function(path, data, cb) {
    this.request('PUT', path, data, cb);
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
