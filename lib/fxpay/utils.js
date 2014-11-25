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

    openWindow: function(options) {
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

      return window.open(options.url, options.title, winOptString);
    }
  };
})();
