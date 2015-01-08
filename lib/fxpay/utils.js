(function() {
  'use strict';

  var exports = fxpay.utils = {};

  exports.defaults = function(object, defaults) {
    object = object || {};
    // Similar to _.defaults except this takes only a single defaults object.
    Object.keys(defaults).forEach(function(key) {
      if (typeof object[key] === 'undefined') {
        object[key] = defaults[key];
      }
    });
    return object;
  };

  exports.getSelfOrigin = function(settings) {
    if (!settings) {
      settings = fxpay.getattr('settings');
    }
    if (settings.appSelf) {
      if (!settings.appSelf.origin) {
        throw new Error('app does not have an origin');
      }
      return settings.appSelf.origin;
    } else {
      var win = settings.window;
      if (win.location.origin) {
        return win.location.origin;
      } else {
        return win.location.protocol + '//' + win.location.hostname;
      }
    }
  };

  exports.getUrlOrigin = function(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.origin || (a.protocol + '//' + a.host);
  };

  exports.openWindow = function(options) {
    var settings = fxpay.getattr('settings');
    var defaults = {
      url: 'about:blank',
      title: 'FxPay',
      w: 276,
      h: 384,
    };

    options = this.defaults(options, defaults);

    var left = (window.screen.width / 2) - (options.w / 2);
    var top_ = (window.screen.height / 2) - (options.h / 2);

    var winOptString = 'toolbar=no,location=no,directories=no,' +
      'menubar=no,scrollbars=no,resizable=no,copyhistory=no,' +
      'width=' + options.w + ',height=' + options.h +
      ',top=' + top_ + ',left=' + left;

    var windowRef = settings.window.open(options.url, options.title,
                                         winOptString);
    if (!windowRef) {
      settings.log.error('window.open() failed. URL:', options.url);
    }
    return windowRef;
  };

})();
