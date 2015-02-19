(function() {
  "use strict";

  function showError(code, message) {
    console.error(message || 'error code:', code);
    $('#error').text(code);
  }

  fxpay.configure({
    allowTestReceipts: true,
    receiptCheckSites: [
      // Allow the production service.
      'https://receiptcheck.marketplace.firefox.com',
      'https://marketplace.firefox.com',

      // The following would not be needed in a live app. These our some test
      // services for development of the fxpay library only.

      // Allow our test servers.
      'https://receiptcheck-dev.allizom.org',
      'https://receiptcheck-marketplace-dev.allizom.org',
      'https://receiptcheck-payments-alt.allizom.org',
      'https://marketplace-dev.allizom.org',
      'https://marketplace.allizom.org',
      'https://payments-alt.allizom.org',

      // Allow some common local servers..
      'http://mp.dev',
      'http://fireplace.loc',
    ],
  });

  fxpay.validateAppReceipt(function(error, info) {
    $('#error').text("");
    var result;
    if (info.receiptInfo) {
      console.log('receipt status:', info.receiptInfo.status);
      if (info.receiptInfo.reason) {
        console.log('receipt status reason:', info.receiptInfo.reason);
      }
    }
    if (error) {
      showError(error, 'invalid receipt');
      result = 'INVALID';
    } else {
      console.log('receipt is valid; app was purchased');
      console.log('product URL:', info.productUrl);
      result = 'VALID';
    }
    $('#results span').text(result);
  });

  console.log('initialized hosted paid app');

})();
