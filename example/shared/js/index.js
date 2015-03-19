$(function() {
  var apiUrlBase;

  var apiUrls = {
    prod: 'https://marketplace.firefox.com',
    dev: 'https://marketplace-dev.allizom.org',
    stage: 'https://marketplace.allizom.org',
    alt: 'https://payments-alt.allizom.org',
    local: queryParam('local_api') || 'http://mp.dev',
  };

  console.log('local API configured as:', apiUrls.local);


  // Helper functions:
  //
  function initApi(env) {
    var productsUl = $('#products ul');
    if (!env) {
      env = $('#api-server option:selected').val();
    }
    apiUrlBase = apiUrls[env];
    if (!apiUrlBase) {
      throw new Error('unknown API env: ' + env);
    }
    console.log('setting API to', apiUrlBase);

    fxpay.configure({
      fakeProducts: $('#simulate-checkbox').is(':checked'),
      apiUrlBase: apiUrlBase,
      adapter: null,  // force re-creation of the adapter.
    });

    // Reset some state.
    clearError();
    clearPurchases();
    productsUl.empty();

    console.log('getting products from', apiUrlBase);

    fxpay.getProducts().then(function(products) {
      products.forEach(function(productInfo) {
        console.info('got product:', productInfo);
        addProduct(productsUl, productInfo);
      });
    }).catch(function(err) {
      console.error('error getting products:', err);
      showError(err);
    });
  }

  function addProduct(parent, prodData, opt) {
    opt = opt || {showBuy: true};
    var li = $('<li></li>', {class: 'product'});
    if (prodData.smallImageUrl) {
      li.append($('<img />', {src: prodData.smallImageUrl,
                              height: 64, width: 64}));
    }
    if (opt.showBuy) {
      li.append($('<button>Buy</button>').data({product: prodData}));
    }
    li.append($('<h3>' + encodeHtmlEntities(prodData.name) + '</h3>'));
    // TODO bug 1042953:
    //li.append($('<p>' + encodeHtmlEntities(prodData.description) + '</p>'));
    li.append($('<div></div>', {class: 'clear'}));
    parent.append(li);
  }

  function encodeHtmlEntities(str) {
    return str.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
      return '&#' + i.charCodeAt(0) + ';';
    });
  }

  function productBought(productInfo) {
    $('#your-products ul li.placeholder').hide();
    addProduct($('#your-products ul'), productInfo, {showBuy: false});
    $('#delete-purchases').show();
  }

  function clearPurchases() {
    $('#your-products ul li:not(.placeholder)').remove();
    $('#your-products ul li.placeholder').show();
  }

  function clearError() {
    $('#error').text('');
  }

  function showError(error) {
    console.error(error.toString());
    $('#error').text(error.toString());
  }

  function queryParam(name) {
    // Returns a query string parameter value by `name` or null.
    var urlParts = window.location.href.split('?');
    var query;
    var value = null;

    if (urlParts.length > 1) {
      query = urlParts[1].split('&');

      query.forEach(function(nameVal) {
        var parts = nameVal.split('=');
        if (parts[0] === name) {
          value = decodeURIComponent(parts[1]);
        }
      });
    }

    return value;
  }


  // DOM handling:
  //
  $('ul').on('click', '.product button', function(evt) {
    evt.preventDefault();
    clearError();
    var prod = $(this).data('product');
    console.log('purchasing', prod.name, prod.productId);

    fxpay.purchase(prod.productId).then(function(product) {
      console.log('product:', product.productId, product, 'purchased');
      productBought(product);
    }).catch(function (err) {
      console.error('error purchasing product',
                    (err.productInfo && err.productInfo.productId),
                    'message:', err.toString());
      showError(err);
    });

    // TODO: update the UI here with a spinner or something.
  });

  $('#delete-purchases').click(function(evt) {
    clearPurchases();
    console.log('clearing all receipts');
    if (fxpay.settings.appSelf) {
      console.log('removing receipts from mozApps');
      var num = 0;
      fxpay.settings.appSelf.receipts.forEach(function(receipt) {
        var req = fxpay.settings.appSelf.removeReceipt(receipt);
        num++;
        req.onsuccess = function() {
          console.log('receipt successfully removed');
        };
        req.onerror = function() {
          console.error('could not remove receipt:', this.error.name);
        };
      });
      console.log('number of receipts removed:', num);
    } else {
      console.log('removing receipts from local storage');
      // I guess this is kind of brutal but it's just a demo app :)
      window.localStorage.clear();
    }
    $('#delete-purchases').hide();
  });

  $('button.install').click(function(evt) {
    var a = document.createElement('a');
    a.href = '/manifest.webapp';
    var fullManifest = (
      a.protocol + '//' + a.hostname + (a.port ? ':' + a.port: '') +
      a.pathname);

    var req = window.navigator.mozApps.install(fullManifest);

    req.onsuccess = function() {
      var app = this.result;
      app.launch();
    };

    req.onerror = function() {
      console.error('Error installing app:', this.error.name);
    };

  });

  $('#api-server').change(function(evt) {
    initApi();
  });

  $('#simulate-checkbox').change(function(evt) {
    initApi();
  });


  // Startup
  //
  console.log('example app startup');

  fxpay.configure({
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
    extraProviderUrls: {
      // Map some development sites.
      'mozilla-dev/payments/pay/v1':
          'https://marketplace-dev.allizom.org/mozpay/?req={jwt}',
      'mozilla-stage/payments/pay/v1':
          'https://marketplace.allizom.org/mozpay/?req={jwt}',
      'mozilla-alt/payments/pay/v1':
          'https://payments-alt.allizom.org/mozpay/?req={jwt}',
      'mozilla-local/payments/pay/v1':
          'http://fireplace.loc/mozpay/?req={jwt}',
    },
    // Initially, start by allowing fake products so that test
    // receipts can validate. The checkbox in initApi() will
    // toggle this setting.
    fakeProducts: true
  });

  fxpay.init({
    onerror: function(err) {
      console.error('error during initialization:', err);
      showError(err);
    },
    oninit: function() {
      console.log('fxpay initialized successfully');
      initApi();
      if (navigator.mozApps && !fxpay.settings.appSelf) {
        // We're running on Firefox web so provide an option
        // to install as an app.
        $('#install-banner').show();
      }
    },
    onrestore: function(err, info) {
      if (err) {
        console.error('error restoring product', info.productId,
                      'message:', err);
        return showError(err);
      }
      console.log('product', info.productId, info, 'restored from receipt');
      productBought(info);
    }
  });
});
