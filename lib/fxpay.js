(function(exports) {
  "use strict";

  exports.purchase = function _purchase(productId, opt) {
    opt = opt || {};
    opt.onpurchase = opt.onpurchase || function(err) {
      if (err) {
        throw err;
      }
    };
    opt.log = opt.log || window.console;
    opt.mozPay = opt.mozPay || navigator.mozPay;
    opt.maxTries = opt.maxTries || undefined;
    opt.pollIntervalMs = opt.pollIntervalMs || undefined;
    opt.apiUrlBase = (opt.apiUrlBase ||
                      'https://marketplace.firefox.com/api/v1');

    var log = opt.log;
    var api = new API(opt.apiUrlBase, {log: log});

    log.debug('starting purchase for product', productId);

    // TODO: this URL is not yet final.
    // See https://bugzilla.mozilla.org/show_bug.cgi?id=980092
    var path = "/payments/in-app/purchase/product/" + productId;
    api.post(path, null, function(err, data) {
      if (err) {
        return opt.onpurchase(err);
      }
      log.debug('xhr load: JSON', data);

      var payReq = opt.mozPay([data.webpayJWT]);

      payReq.onerror = function() {
        log.error('mozPay: received onerror()');
        // TODO: fire a callback here for apps.
      };

      payReq.onsuccess = function() {
        log.debug('mozPay: received onsuccess()');
        // TODO: fire a callback here for apps so they can update their UI.

        getTransactionResult(api, data.contribStatusURL, function(err) {
          if (err) {
            return opt.onpurchase(err);
          }
          // The item has been purchased!
          opt.onpurchase(null);
        }, {
          log: log,
          maxTries: opt.maxTries,
          pollIntervalMs: opt.pollIntervalMs
        });
      };
    });
  };


  // NOTE: if you change this function signature, change the setTimeout below.
  function getTransactionResult(api, transStatusPath, cb, opt) {
    opt = opt || {};
    opt.log = opt.log || window.console;
    opt.maxTries = opt.maxTries || 10;
    opt.pollIntervalMs = opt.pollIntervalMs || 1000;
    opt._tries = opt._tries || 1;

    var log = opt.log;
    log.debug('Getting transaction state at', api.url(transStatusPath),
              'tries=', opt._tries);

    if (opt._tries > opt.maxTries) {
      log.error('Giving up on transaction at', api.url(transStatusPath),
                'after', opt._tries, 'tries');
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
    opt.log = opt.log || window.console;

    this.log = opt.log;
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
