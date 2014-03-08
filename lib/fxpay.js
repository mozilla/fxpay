(function(exports) {
  "use strict";

  exports.purchase = function _purchase(productId, options) {
    options = options || {};
    options.onpurchase = options.onpurchase || function(err) {
      if (err) {
        throw err;
      }
    };
    options.log = options.log || window.console;
    options.mozPay = options.mozPay || navigator.mozPay;
    options.maxTries = options.maxTries || 10;
    options.pollIntervalMs = options.pollIntervalMs || 1000;
    options.apiUrlBase = (options.apiUrlBase ||
                          'https://marketplace.firefox.com/api/v1');

    var log = options.log;
    var api = new API(options.apiUrlBase, {log: log});

    log.debug('starting purchase for product', productId);

    // TODO: this URL is not yet final.
    // See https://bugzilla.mozilla.org/show_bug.cgi?id=980092
    var path = "/payments/in-app/purchase/product/" + productId;
    api.post(path, null, function(err, data) {
      if (err) {
        return options.onpurchase(err);
      }
      log.debug('xhr load: JSON', data);

      var payReq = options.mozPay([data.webpayJWT]);

      payReq.onerror = function() {
        log.error('mozPay: received onerror()');
        // TODO: fire a callback here for apps.
      };

      payReq.onsuccess = function() {
        log.debug('mozPay: received onsuccess()');
        // TODO: fire a callback here for apps so they can update their UI.

        getTransactionResult(api, data.contribStatusURL, function(err) {
          if (err) {
            return options.onpurchase(err);
          }
          // The item has been purchased!
          options.onpurchase(null);
        }, {
          log: log,
          maxTries: options.maxTries,
          pollIntervalMs: options.pollIntervalMs
        });
      };
    });
  };


  // NOTE: if you change this function signature, change the setTimeout below.
  function getTransactionResult(api, transStatusPath, cb, options) {
    options = options || {};
    options.log = options.log || window.console;
    options.maxTries = options.maxTries || 10;
    options.pollIntervalMs = options.pollIntervalMs || 1000;
    options._tries = options._tries || 1;

    var log = options.log;
    log.debug('Getting transaction state at', api.url(transStatusPath),
              'tries=', options._tries);

    if (options._tries > options.maxTries) {
      log.error('Giving up on transaction at', api.url(transStatusPath),
                'after', options._tries, 'tries');
      return cb('TRANSACTION_TIMEOUT');
    }

    // TODO: get or post?
    // TODO: may need to strip the /api/v1 prefix.
    api.post(transStatusPath, null, function(err, data) {
      if (err) {
        return cb(err);
      }

      // TODO: make sure these state values are realistic.
      if (data.state === 'COMPLETED') {
        // The transaction is complete.
        return cb(null, data);
      } else if (data.state === 'PENDING') {
        log.debug('Re-trying pending transaction');
        window.setTimeout(function() {
          getTransactionResult(api, transStatusPath, cb, {
            log: log,
            maxTries: options.maxTries,
            pollIntervalMs: options.pollIntervalMs,
            _tries: options._tries + 1
          });
        }, options.pollIntervalMs);
      } else {
        log.error('transaction state', data.state, 'from',
                  api.url(transStatusPath), 'was unexpected');
        return cb('INVALID_TRANSACTION_STATE');
      }
    });
  }


  function API(baseUrl, options) {
    options = options || {};
    options.log = options.log || window.console;

    this.log = options.log;
    this.baseUrl = baseUrl;
  }

  API.prototype.url = function(path) {
    return this.baseUrl + path;
  };

  API.prototype.post = function(path, data, cb) {
    var log = this.log;
    var url = this.url(path);
    var xhr = new XMLHttpRequest();
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
          var code = 'BAD_API_RESPONSE';
          log.error(code, 'status:', this.status, 'for URL:', url);
          log.debug(code, 'response:', this.responseText);
          return cb('BAD_API_RESPONSE');
        }

        log.debug('xhr load: GOT', this.responseText);
        try {
          data = JSON.parse(this.responseText);
        } catch (parseErr) {
          var code = 'BAD_JSON_RESPONSE';
          log.error(code, 'for URL:', url,
                    'exception', parseErr,
                    'response:', this.responseText);
          return cb(code);
        }

        cb(null, data);
      }
    };

    for (var k in events) {
      xhr.addEventListener(k, events[k], false);
    }

    log.debug('opening POST to', url);
    xhr.open("POST", url, true);
    xhr.send(data);
  };

})(typeof exports === 'undefined' ? (this.fxpay = {}): exports);
