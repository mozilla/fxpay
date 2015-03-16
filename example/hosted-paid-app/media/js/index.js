(function() {
  "use strict";

  function showResult(result, error) {
    $('#error').text(error ? error.toString(): "");
    $('#results span').text(result);
  }

  function logProductInfo(productInfo) {
    console.log('productInfo:', productInfo);
    if (productInfo && productInfo.receiptInfo) {
      console.log('receipt status:', productInfo.receiptInfo.status);
      if (productInfo.receiptInfo.reason) {
        console.log('receipt status reason:', productInfo.receiptInfo.reason);
      }
    }
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

  fxpay.validateAppReceipt().then(function(productInfo) {
    logProductInfo(productInfo);
    console.log('receipt is valid; app was purchased');
    console.log('product URL:', productInfo.productUrl);
    showResult('VALID');
  }).catch(function(reason) {
    logProductInfo(reason.productInfo);
    showResult('INVALID', reason.error || reason);
  });

  console.log('initialized hosted paid app');

})();
