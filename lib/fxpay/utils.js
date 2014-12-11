(function() {
  'use strict';

  if (typeof window.fxpay === 'undefined') {
    window.fxpay = {};
  }

  window.fxpay.utils = {
    namespace: function(namespace) {
      var ns = window;
      var parts = namespace.split('.');
      // window is implied, so it is ignored if it is included
      for (var j=(parts[0] === 'window') ? 1 : 0; j < parts.length; j++) {
        ns[parts[j]] = ns[parts[j]] || {};
        ns = ns[parts[j]];
      }
      return ns;
    },

    defaults: function(object, defaults) {
      object = object || {};
      // Similar to _.defaults except this takes only a single defaults object.
      Object.keys(defaults).forEach(function(key) {
        if (typeof object[key] === 'undefined') {
          object[key] = defaults[key];
        }
      });
      return object;
    },

    getSelfOrigin: function(settings) {
      if (!settings) {
        settings = require('fxpay/settings');
      }
      if (settings.appSelf) {
        // TODO: error if this packaged app does not define an origin.
        // See https://bugzilla.mozilla.org/show_bug.cgi?id=1109946
        return settings.appSelf.origin;
      } else {
        var win = settings.window || window;
        if (win.location.origin) {
          return win.location.origin;
        } else {
          return win.location.protocol + '//' + win.location.hostname;
        }
      }
    },

    openWindow: function(options) {
      var settings = require('fxpay/settings');
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

      var windowRef = settings.openWindow(options.url, options.title,
                                          winOptString);
      if (!windowRef) {
        settings.log.error('window.open() failed. URL:', options.url);
      }
      return windowRef;
    }
  };
})();
