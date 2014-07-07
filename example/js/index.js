$(function() {
  var apiUrlBase;

  // TODO: get these from the API instead.
  var products = {
    '1': {
      name: 'Virtual Kiwi',
      description: 'The forbidden fruit',
      icons: {
        '64': 'img/kiwi_64.png',
      }
    },
    '2': {
      name: 'Magic Cheese',
      description: 'A majestic wedge of swiss cheese',
      icons: {
        '64': 'img/cheese_64.png',
      }
    }
  };

  var apiUrls = {
    prod: 'https://marketplace.firefox.com',
    dev: 'https://marketplace-dev.allizom.org',
    stage: 'https://marketplace.allizom.org',
    alt: 'https://payments-alt.allizom.org',
    local: 'http://fireplace.loc',
  };


  // Helper functions:
  //
  function setApiServer(env) {
    if (!env) {
      env = $('#api-server option:selected').val();
    }
    apiUrlBase = apiUrls[env];
    if (!apiUrlBase) {
      throw 'unknown API env: ' + env;
    }
    console.log('setting API to', apiUrlBase);
    fxpay.configure({apiUrlBase: apiUrlBase});
  }

  function addProduct(parent, prodID, prodData, opt) {
    opt = opt || {showBuy: true};
    var li = $('<li></li>', {class: 'product'});
    li.append($('<img />', {src: prodData.icons['64'],
                            height: 64, width: 64}));
    if (opt.showBuy) {
      li.append($('<button>Buy</button>').data({productId: prodID,
                                                product: prodData}));
    }
    li.append($('<h3>' + prodData.name + '</h3>'));
    li.append($('<p>' + prodData.description + '</p>'));
    li.append($('<div></div>', {class: 'clear'}));
    parent.append(li);
  }

  function productBought(productId) {
    $('#your-products ul li.placeholder').remove();
    addProduct($('#your-products ul'), productId,
               products[productId], {showBuy: false});
  }

  function showError(msg) {
    console.error(msg);
    $('#error').text(msg);
  }


  // DOM handling:
  //
  $('ul').on('click', '.product button', function() {
    $('#error').text('');
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
    setApiServer();
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
      showError(err);
    },
    oninit: function() {
      console.log('fxpay initialized successfully');
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

  setApiServer();
  var ul = $('#products ul');

  for (var prodId in products) {
    addProduct(ul, prodId, products[prodId]);
  }
});
