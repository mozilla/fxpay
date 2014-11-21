(function() {
  'use strict';

  if (typeof window.fxpay === 'undefined') {
    window.fxpay = {};
  }

  window.fxpay.utils = {
    namespace: function() {
      var args = arguments;
      var ns = null;
      var parts;
      for (var i=0; i < args.length; i++) {
        ns = window;
        parts = args[i].split('.');
        // window is implied, so it is ignored if it is included
        for (var j=(parts[0] === 'window') ? 1 : 0; j < parts.length; j++) {
          ns[parts[j]] = ns[parts[j]] || {};
          ns = ns[parts[j]];
        }
      }
      return ns;
    }
  };
})();
