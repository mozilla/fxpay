$(function() {
  var apiUrlBase;

  var apiUrls = {
    prod: 'https://marketplace.firefox.com',
    dev: 'https://marketplace-dev.allizom.org',
    stage: 'https://marketplace.allizom.org',
    alt: 'https://payments-alt.allizom.org',
    local: 'http://mp.dev',
  };


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
      apiUrlBase: apiUrlBase
    });

    // Reset some state.
    clearError();
    clearPurchases();
    productsUl.empty();

    console.log('getting products from', apiUrlBase);

    fxpay.getProducts(function(err, products) {
      if (err) {
        console.error('error getting products:', err);
        return showError(err);
      }
      products.forEach(function(productInfo) {
        console.info('got product:', productInfo);
        addProduct(productsUl, productInfo);
      });
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
  }

  function clearPurchases() {
    $('#your-products ul li:not(.placeholder)').remove();
    $('#your-products ul li.placeholder').show();
  }

  function clearError() {
    $('#error').text('');
  }

  function showError(msg) {
    console.error(msg);
    $('#error').text(msg);
  }


  // DOM handling:
  //
  $('ul').on('click', '.product button', function() {
    clearError();
    var prod = $(this).data('product');
    console.log('purchasing', prod.name, prod.productId);

    fxpay.purchase(prod.productId, function(err, product) {
      if (err) {
        console.error('error purchasing product',
                      (product && product.productId),
                      'message:', err);
        return showError(err);
      }
      console.log('product:', product.productId, product, 'purchased');
      productBought(product);
    });

    // TODO: update the UI here with a spinner or something.
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
      // Whitelist the production service.
      'https://receiptcheck.marketplace.firefox.com',
      'https://marketplace.firefox.com',

      // The following would not be needed in a live app. These our some test
      // services for development of the fxpay library only.

      // Whitelist our test servers.
      'https://receiptcheck-dev.allizom.org',
      'https://marketplace-dev.allizom.org',
      'https://receiptcheck-payments-alt.allizom.org',
      'https://payments-alt.allizom.org',

      // Whitelist a local development server I use.
      'http://fireplace.loc',
    ],
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
