(function(exports) {
  "use strict";

  exports.purchase = function _purchase(productId, options) {
    options = options || {};
    options.onpurchase = options.onpurchase || function(err/*, result*/) {
      if (err) {
        throw err;
      }
    };
    options.log = options.log || window.console;
    options.mozPay = options.mozPay || navigator.mozPay;
    options.apiUrlBase = (options.apiUrlBase ||
                          'https://marketplace.firefox.com/api/v1');

    var log = options.log;
    var api = new API(options.apiUrlBase, {log: options.log});

    log.debug('starting purchase for product', productId);

    // TODO: this URL is not yet final.
    var path = "/payments/in-app/purchase/product/" + productId;
    api.post(path, null, function(err, data) {
      if (err) {
        options.onpurchase(err);
        return;
      }
      log.debug('xhr load: JSON', data);

      var payReq = options.mozPay([data.webpayJWT]);

      payReq.onerror = function() {
        log.error('mozPay: received onerror()');
      };

      payReq.onsuccess = function() {
        log.debug('mozPay: received onsuccess()');
        // TODO: poll for postback
        // TODO: move this to when after polling is complete.
        options.onpurchase(null);
      };
    });
  };


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
    var oReq = new XMLHttpRequest();
    // This doesn't seem to be supported by sinon yet.
    //oReq.responseType = "json";

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
        if (this.status.toString().slice(0,1) !== '2') {
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
      oReq.addEventListener(k, events[k], false);
    }

    log.debug('opening POST to', url);
    oReq.open("POST", url, true);
    oReq.send(data);
  };

})(typeof exports === 'undefined' ? (this.fxpay = {}): exports);
