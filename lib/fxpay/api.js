(function() {
  'use strict';

  var exports = window.fxpay.utils.namespace('fxpay.api');

  var settings = require('fxpay/settings');

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

    opt.headers = opt.headers || {};
    for (var h in defaultHeaders) {
      if (!(h in opt.headers)) {
        opt.headers[h] = defaultHeaders[h];
      }
    }
    opt.headers['x-fxpay-version'] = settings.libVersion;

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
    // TODO: remove mozSystem when CORS is fully supported.
    // See https://bugzilla.mozilla.org/show_bug.cgi?id=1104371
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

})();
