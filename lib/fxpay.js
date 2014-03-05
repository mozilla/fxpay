(function(exports) {
  "use strict";

  exports.purchase = function _purchase(productId, options) {
    options = options || {};
    options.done = options.done || function() {};
    options.apiUrlBase = (options.apiUrlBase ||
                          'https://marketplace.firefox.com/api/v1');

  };

})(typeof exports === 'undefined' ? (this.fxpay = {}): exports);
