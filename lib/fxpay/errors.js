(function() {
  'use strict';

  var exports = fxpay.errors = {};

  exports.createError = createError;

  // All error classes will implicitly inherit from this.
  exports.FxPayError = createError('FxPayError');

  exportErrors([
    ['ConfigurationError'],
    ['FailedWindowMessage'],
    ['IncorrectUsage'],
    ['InvalidApp'],
    ['InvalidJwt'],
    ['NotImplementedError'],
    ['PayWindowClosedByUser', {code: 'DIALOG_CLOSED_BY_USER'}],
    ['UnknownMessageOrigin'],
  ]);


  exports.PaymentFailed = createError('PaymentFailed');

  exportErrors([
    ['AppReceiptMissing'],
    ['InvalidReceipt'],
    ['PurchaseTimeout'],
    ['TestReceiptNotAllowed'],
  ], {
    inherits: exports.PaymentFailed,
  });


  exports.PlatformError = createError('PlatformError');

  exportErrors([
    ['AddReceiptError'],
    ['PayPlatformError'],
    ['PayPlatformUnavailable'],
  ], {
    inherits: exports.PlatformError,
  });


  exports.ApiError = createError('ApiError');

  exportErrors([
    ['ApiRequestAborted'],
    ['ApiRequestError'],
    ['ApiRequestTimeout'],
    ['BadApiResponse'],
    ['BadJsonResponse'],
  ], {
    inherits: exports.ApiError,
  });


  function createError(name, classOpt) {
    classOpt = classOpt || {};
    var errorParent = classOpt.inherits || exports.FxPayError || Error;

    function CreatedFxPayError(message, opt) {
      opt = opt || {};
      var settings = fxpay.getattr('settings');

      if (!(this instanceof CreatedFxPayError)) {
        // Let callers create instances without `new`.
        return new CreatedFxPayError(message, opt);
      }
      this.message = message;
      this.stack = (new Error()).stack;
      if (opt.code) {
        this.code = opt.code;
      }

      var logger = settings.log || console;
      logger.error(this.toString());
    }

    CreatedFxPayError.prototype = Object.create(errorParent.prototype);
    CreatedFxPayError.prototype.name = name;

    if (classOpt.code) {
      CreatedFxPayError.prototype.code = classOpt.code;
    }

    CreatedFxPayError.prototype.toString = function() {
      var str = Error.prototype.toString.call(this);
      if (this.code) {
        str += ' {code: ' + this.code + '}';
      }
      return str;
    };

    return CreatedFxPayError;
  }


  function exportErrors(errList, defaultOpt) {
    errList.forEach(function(errArgs) {
      var cls = errArgs[0];
      var opt = defaultOpt || {};
      if (errArgs[1]) {
        Object.keys(errArgs[1]).forEach(function(optKey) {
          opt[optKey] = errArgs[1][optKey];
        });
      }
      // Export the created error class.
      exports[cls] = createError.call(this, cls, opt);
    });
  }

})();
