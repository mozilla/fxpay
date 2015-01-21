(function() {
  'use strict';

  var exports = fxpay.settings = {};
  var pkgInfo = {"version": "0.0.8"};  // this is updated by `grunt bump`

  var defaultSettings = {

    // Public settings.
    //
    // Disallow receipts belonging to other apps.
    allowAnyAppReceipt: false,
    apiUrlBase: 'https://marketplace.firefox.com',
    apiVersionPrefix: '/api/v1',
    // When truthy, this will override the API object's default.
    apiTimeoutMs: null,
    // When defined, this optional map will override or
    // append values to payProviderUrls.
    extraProviderUrls: null,
    // When true, work with fake products and test receipts.
    fakeProducts: false,
    // This object is used for all logging.
    log: window.console || {
      // Shim in a minimal set of the console API.
      debug: function() {},
      error: function() {},
      info: function() {},
      log: function() {},
      warn: function() {},
    },
    // Only these receipt check services are allowed.
    receiptCheckSites: [
      'https://receiptcheck.marketplace.firefox.com',
      'https://marketplace.firefox.com'
    ],

    // Private settings.
    //
    adapter: null,
    // This will be the App object returned from mozApps.getSelf().
    // On platforms that do not implement mozApps it will be null.
    appSelf: null,
    // Boolean flag to tell if we have addReceipt() or not.
    hasAddReceipt: null,
    // Map of JWT types to payment provider URLs.
    payProviderUrls: {
      'mozilla/payments/pay/v1':
          'https://marketplace.firefox.com/mozpay/?req={jwt}'
    },
    // Reference window so tests can swap it out with a stub.
    window: window,
    // Width for payment window as a popup.
    winWidth: 276,
    // Height for payment window as a popup.
    winHeight: 384,
    // Relative API URL that accepts a product ID and returns a JWT.
    prepareJwtApiUrl: '/webpay/inapp/prepare/',
    onerror: function(err) {
      throw err;
    },
    oninit: function() {
      exports.log.info('fxpay version:', exports.libVersion);
      exports.log.info('initialization ran successfully');
    },
    onrestore: function(error, info) {
      if (error) {
        exports.log.error('error while restoring product:', info.productId,
                          'message:', error);
      } else {
        exports.log.info('product', info.productId,
                         'was restored from receipt');
      }
    },
    // A record of the initialization error, if there was one.
    initError: 'NOT_INITIALIZED',
    localStorage: window.localStorage || null,
    localStorageKey: 'fxpayReceipts',
    mozPay: navigator.mozPay || null,
    mozApps: navigator.mozApps || null,
    libVersion: pkgInfo.version,
  };

  exports.configure = function settings_configure(newSettings, opt) {
    opt = opt || {};
    if (opt.reset) {
      for (var def in defaultSettings) {
        exports[def] = defaultSettings[def];
      }
    }
    for (var param in newSettings) {
      if (typeof exports[param] === 'undefined') {
        exports.log.error('configure() received an unknown setting:', param);
        return exports.onerror('INCORRECT_USAGE');
      }
      exports[param] = newSettings[param];
    }

    if (exports.extraProviderUrls) {
      exports.log.info('adding extra pay provider URLs',
                       exports.extraProviderUrls);
      for (var paySpec in exports.extraProviderUrls) {
        exports.payProviderUrls[paySpec] = exports.extraProviderUrls[paySpec];
      }
    }

    var DefaultAdapter = fxpay.getattr('adapter').FxInappAdapter;
    if (!exports.adapter) {
      exports.log.info('using default adapter');
      exports.adapter = new DefaultAdapter();
    } else {
      exports.log.info('using custom adapter');
    }

    return exports;
  };

})();
