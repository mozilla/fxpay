(function(exports) {
  var utils = fxpay.getattr('utils');

  exports.server = null;
  exports.settings = null;
  exports.someAppOrigin = 'app://my-app';
  // Product info as returned from a GET request to the API.
  exports.apiProduct = {guid: 'server-guid', name: "Name from API",
                        logo_url: "img.jpg"};


  exports.setUp = function setUp() {
    exports.server = sinon.fakeServer.create();
    exports.settings = fxpay.settings.configure({
      apiUrlBase: 'http://tests-should-never-hit-this.com',
      mozApps: exports.mozAppsStub,
      productReceiptMap: null,
    }, {
      reset: true
    });
    window.localStorage.clear();
    exports.appSelf.init();
  };


  exports.tearDown = function tearDown() {
    exports.server.restore();
  };


  exports.makeReceipt = function makeReceipt(data, opt) {
    // Generate a pseudo web application receipt.
    // https://wiki.mozilla.org/Apps/WebApplicationReceipt
    data = data || {};
    opt = opt || {};

    // Fill in some defaults:
    data.typ = data.typ || 'purchase-receipt';
    data.iss = data.iss || 'https://payments-alt.allizom.org';
    data.verify = (data.verify ||
                   'https://fake-receipt-check-server.net/verify/');
    data.product = data.product || {
      url: opt.productUrl || helper.someAppOrigin,
      storedata: opt.storedata || 'contrib=297&id=500419&inapp_id=1'
    };
    data.user = data.user || {
      type: 'directed-identifier',
      value: 'anonymous-user'
    };

    // Make up some fake timestamps.
    data.iat = data.iat || 1402935236;
    data.exp = data.exp || 1418660036;
    data.nbf = data.nbf || 1402935236;

    // Make a URL safe base 64 encoded receipt:
    var receipt = (btoa(JSON.stringify(data)).replace(/\+/g, '-')
                   .replace(/\//g, '_').replace(/\=+$/, ''));

    // jwtKey and jwtSig are stubbed out here because they
    // are not used by the library.
    return 'jwtKey.' + (opt.receipt || receipt) + '.jwtSig';
  };


  exports.resolvePurchase = function(opt) {
    var cfg = fxpay.getattr('settings');
    var helper = exports;
    opt = fxpay.utils.defaults(opt, {
      receipt: '<keys>~<receipt>',
      mozPay: null,
      productData: null,
      payCompleter: null,
      fetchProductsPattern: new RegExp('.*/payments/.*/in-app/.*'),
      enableTransPolling: false,
      mozPayResolver: function(domRequest) {
        domRequest.onsuccess();
      },
      addReceiptResolver: function(domRequest) {
        domRequest.onsuccess();
      },
    });

    if (!opt.transData) {
      opt.transData = helper.transactionData({receipt: opt.receipt});
    }

    // Respond to fetching the JWT.
    helper.server.respondWith(
      'POST',
      cfg.apiUrlBase + cfg.apiVersionPrefix + '/webpay/inapp/prepare/',
      helper.productData(opt.productData));
    helper.server.respond();

    if (opt.mozPay) {
      console.log('Simulate a payment completion with mozPay');
      // Resolve DOMRequest for navigator.mozPay().
      opt.mozPayResolver(opt.mozPay.returnValues[0]);
    } else if (opt.payCompleter) {
      console.log('Simulate a payment completion with custom function');
      opt.payCompleter();
    }

    // Respond to checking the transaction state.
    helper.server.autoRespond = !!opt.enableTransPolling;
    helper.server.respondWith('GET', cfg.apiUrlBase + '/transaction/XYZ',
                              opt.transData);
    helper.server.respond();

    // Resolve DOMRequest for mozApps.getSelf().addReceipt().
    opt.addReceiptResolver(helper.receiptAdd);

    // Respond to fetching the product object after successful transaction.
    helper.server.respondWith('GET', opt.fetchProductsPattern,
                              [200, {"Content-Type": "application/json"},
                               JSON.stringify(helper.apiProduct)]);
    helper.server.respond();
  };


  exports.productData = function(overrides, status) {
    // Create a JSON helper.server response to a request for product data.
    overrides = overrides || {};
    var data = {
      webpayJWT: '<jwt>',
      contribStatusURL: '/transaction/XYZ',
    };
    for (var k in data) {
      if (overrides[k]) {
        data[k] = overrides[k];
      }
    }
    return [status || 200, {"Content-Type": "application/json"},
            JSON.stringify(data)];
  };


  exports.transactionData = function(overrides, status) {
    // Create a JSON helper.server response to a request for transaction data.
    overrides = overrides || {};
    var data = {
      status: 'complete',
      // Pretend this is a real Marketplace receipt.
      receipt: '<keys>~<receipt>'
    };
    for (var k in data) {
      if (overrides[k]) {
        data[k] = overrides[k];
      }
    }
    return [status || 200, {"Content-Type": "application/json"},
            JSON.stringify(data)];
  };


  exports.receiptAdd = {
    error: null,
    _receipt: null,
    onsuccess: function() {},
    onerror: function() {},
    reset: function() {
      this._receipt = null;
      this.error = null;
      this.onsuccess = function() {};
      this.onerror = function() {};
    }
  };


  exports.appSelf = {
    init: function() {
      this.error = null;
      this.origin = exports.someAppOrigin;
      this.manifest = {
        installs_allowed_from: ['*'],
        permissions: {
          systemXHR: {description: "Required to access payment API"}
        }
      };
      this.receipts = [];
      // This is the result of getSelf(). Setting it to this makes
      // stubbing easier.
      this.result = this;

      this.addReceipt = function(receipt) {
        exports.receiptAdd._receipt = receipt;
        return exports.receiptAdd;
      };
    },
    onsuccess: function() {},
    onerror: function() {}
  };


  // https://developer.mozilla.org/en-US/docs/Web/API/Apps.getSelf
  exports.mozAppsStub = {
    getSelf: function() {
      return exports.appSelf;
    }
  };


  exports.ReceiptValidator = function ReceiptValidator(opt) {
    opt = utils.defaults(opt, {
      response: {status: 'ok'},
      onValidationResponse: undefined,
      onRequest: function() {},
      verifyUrl: 'https://fake-receipt-check-server.net/verify/',
    });

    if (!opt.onValidationResponse) {
      opt.onValidationResponse = function(request) {
        opt.onRequest(request.requestBody);
        request.respond(200, {"Content-Type": "application/json"},
                        JSON.stringify(opt.response));
      };
    }

    helper.server.respondWith('POST', opt.verifyUrl, opt.onValidationResponse);
  };

  exports.ReceiptValidator.prototype.finish = function() {
    // Send the receipt validation response:
    helper.server.respond();
  };


  exports.mozPayStub = function mozPayStub() {
    // https://developer.mozilla.org/en-US/docs/Web/API/Navigator.mozPay
    return {
      onsuccess: function() {},
      onerror: function() {},
    };
  };


})(typeof exports === 'undefined' ? (this.helper = {}): exports);
