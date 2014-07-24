$(function() {
  var apiUrlBase;
  var catalog = {};

  var apiUrls = {
    prod: 'https://marketplace.firefox.com',
    dev: 'https://marketplace-dev.allizom.org',
    stage: 'https://marketplace.allizom.org',
    alt: 'https://payments-alt.allizom.org',
    local: 'http://fireplace.loc',
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
    fxpay.configure({apiUrlBase: apiUrlBase});

    // Reset some state.
    clearError();
    clearPurchases();
    catalog = {};
    productsUl.empty();

    console.log('getting products from', apiUrlBase);

    fxpay.getProducts(function(err, products) {
      if (err) {
        console.error('error getting products:', err);
        return showError(err);
      }
      products.forEach(function(productInfo) {
        console.info('got product:', productInfo);
        catalog[productInfo.productId] = productInfo;
        addProduct(productsUl, productInfo.productId, productInfo);
      });
    });
  }

  function addProduct(parent, prodID, prodData, opt) {
    opt = opt || {showBuy: true};
    var li = $('<li></li>', {class: 'product'});
    if (prodData.smallImageUrl) {
      li.append($('<img />', {src: prodData.smallImageUrl,
                              height: 64, width: 64}));
    }
    if (opt.showBuy) {
      li.append($('<button>Buy</button>').data({productId: prodID,
                                                product: prodData}));
    }
    li.append($('<h3>' + prodData.name + '</h3>'));
    // TODO bug 1042953:
    //li.append($('<p>' + prodData.description + '</p>'));
    li.append($('<div></div>', {class: 'clear'}));
    parent.append(li);
  }

  function productBought(productId) {
    $('#your-products ul li.placeholder').hide();
    var productInfo = catalog[productId];
    if (!productInfo) {
      console.error('purchased product ID', productId,
                    'is not a known product. Known:', Object.keys(catalog));
    }
    addProduct($('#your-products ul'), productId,
               productInfo, {showBuy: false});
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
    var id = $(this).data('productId');
    var prod = $(this).data('product');
    console.log('purchasing', prod.name, id);

    fxpay.purchase(id, function(err, info) {
      if (err) {
        console.error('error purchasing product', info.productId,
                      'message:', err);
        return showError(err);
      }
      console.log('product:', info.productId, 'purchased');
      productBought(info.productId);
    });

    // TODO: update the UI here with a spinner or something.
  });

  $('#api-server').change(function(evt) {
    initApi();
  });


  // Startup
  //
  console.log('example app startup');

  fxpay.configure({
    receiptCheckSites: [
      // Whitelist some test services.
      'https://receiptcheck.marketplace.firefox.com',
      'https://receiptcheck-payments-alt.allizom.org',
    ]
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
      console.log('product', info.productId, 'restored from receipt');
      productBought(info.productId);
    }
  });
});
