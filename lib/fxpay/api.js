(function() {
  'use strict';

  var exports = fxpay.api = {};

  var errors = fxpay.getattr('errors');
  var settings = fxpay.getattr('settings');

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
    var xhr = new XMLHttpRequest();
    // This doesn't seem to be supported by sinon yet.
    //xhr.responseType = "json";

    var events = {
      abort: function() {
        cb(errors.ApiRequestAborted('XHR request aborted for path: ' + path));
      },
      error: function(evt) {
        log.debug('XHR error event:', evt);
        cb(errors.ApiRequestError('received XHR error for path: ' + path));
      },
      load: function() {
        var data;
        if (this.status.toString().slice(0, 1) !== '2') {
          // TODO: handle status === 0 ?
          // TODO: handle redirects?
          var err = errors.BadApiResponse(
                    'Unexpected status: ' + this.status + ' for URL: ' + url);
          log.debug(err.toString(), 'response:', this.responseText);
          return cb(err);
        }

        log.debug('XHR load: GOT response:', this.responseText);
        try {
          // TODO: be smarter about content-types here.
          data = JSON.parse(this.responseText);
        } catch (parseErr) {
          var err = errors.BadJsonResponse(
              'Unparsable JSON for URL: ' + url + '; exception: ' + parseErr);
          log.debug(err.toString(), 'response:', this.responseText);
          return cb(err);
        }

        cb(null, data);
      },
      timeout: function() {
        cb(errors.ApiRequestTimeout(
              'XHR request to ' + url + ' timed out after ' +
              api.timeoutMs + 'ms'));
      }
    };

    for (var k in events) {
      xhr.addEventListener(k, events[k], false);
    }

    log.debug('opening', method, 'to', url);
    xhr.open(method, url, true);

    // Has to be after xhr.open to avoid
    // invalidStateError in IE.
    xhr.timeout = api.timeoutMs;

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
