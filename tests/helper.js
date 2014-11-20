(function(exports) {

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
    // Start with this true because init() sets it and it's
    // cumbersome to re-init some tests.
    hasAddReceipt: true,
    initError: null,
    mozApps: exports.mozAppsStub
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
                 'https://receiptcheck-payments-alt.allizom.org/verify/');
  data.product = data.product || {
    url: opt.productUrl || 'http://boar4485.testmanifest.com',
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


exports.receiptAdd = {
  error: null,
  _receipt: null,
  onsuccess: function() {},
  onerror: function() {},
  reset: function() {
    this._receipt = null;
    this.error = null;
  }
};


exports.appSelf = {
  init: function() {
    this.error = null;
    this.origin = exports.someAppOrigin;
    this.manifest = {
      permissions: {
        systemXHR: {description: "Required to access payment API"}
      }
    };
    this.receipts = [];
    // This is the result of getSelf(). Setting it to this makes stubbing easier.
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


})(typeof exports === 'undefined' ? (this.helper = {}): exports);
