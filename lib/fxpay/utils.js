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
    }
  };
})();
