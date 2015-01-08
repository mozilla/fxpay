// This is a minimal bootstrapping script that defines the fxpay
// namespace and allows all other modules to require fxpay attributes.
(function() {
  'use strict';

  if (typeof window.fxpay !== 'undefined') {
    throw new Error('fxpay/init_module.js must be loaded before other scripts');
  }

  var exports = window.fxpay = {};

  exports.getattr = function getattr(attr) {

    // Checks that 'any.attribute.foo' exists on the fxpay global
    // and returns the object.

    var parts = attr.split('.');
    var module = window.fxpay;
    var trail = '';
    for (var i = 0; i < parts.length; i++) {
      if (trail) {
        trail += '.';
      }
      trail += parts[i];
      if (!module.hasOwnProperty(parts[i])) {
        throw new Error('The module "' + attr + '" is not ' +
                        'defined on fxpay. First undefined ' +
                        'part: "' + trail + '"');
      }
      module = module[parts[i]];
    }

    return module;
  };

})();
