define([
  'exports',
  'settings'
], function(exports, settings) {

  'use strict';

  exports.createError = createError;

  // All error classes will implicitly inherit from this.
  exports.FxPayError = createError('FxPayError');

  exportErrors([
    ['ApiError'],
    ['ConfigurationError'],
    ['FailedWindowMessage'],
    ['IncorrectUsage'],
    ['InvalidApp'],
    ['InvalidJwt'],
    ['NotImplementedError'],
    ['PaymentFailed'],
    ['PayWindowClosedByUser', {code: 'DIALOG_CLOSED_BY_USER'}],
    ['PlatformError'],
    ['UnknownMessageOrigin'],
  ]);


  exportErrors([
    ['InvalidAppOrigin'],
  ], {
    inherits: exports.InvalidApp,
  });


  exportErrors([
    ['AppReceiptMissing'],
    ['InvalidReceipt'],
    ['PurchaseTimeout'],
    ['TestReceiptNotAllowed'],
  ], {
    inherits: exports.PaymentFailed,
  });


  exportErrors([
    ['AddReceiptError'],
    ['PayPlatformError'],
    ['PayPlatformUnavailable'],
  ], {
    inherits: exports.PlatformError,
  });


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

      if (!(this instanceof CreatedFxPayError)) {
        // Let callers create instances without `new`.
        var obj = Object.create(CreatedFxPayError.prototype);
        return CreatedFxPayError.apply(obj, arguments);
      }
      this.message = message;
      this.stack = (new Error()).stack;
      if (opt.code) {
        this.code = opt.code;
      }

      // Some code will attach a productInfo object
      // on to the exception before throwing.
      // This object contains information such as
      // the exact reason why a receipt was invalid.
      this.productInfo = opt.productInfo || {};
      var logger = settings.log || console;
      logger.error(this.toString());

      return this;
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

});
