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
  }

  function addProduct(parent, prodID, prod, opt) {
    opt = opt || {showBuy: true};
    var li = $('<li></li>', {class: 'product'});
    li.append($('<img />', {src: prod.icons['64'], height: 64, width: 64}));
    if (opt.showBuy) {
      li.append($('<button>Buy</button>').data({productId: prodID, product: prod}));
    }
    li.append($('<h3>' + prod.name + '</h3>'));
    li.append($('<p>' + prod.description + '</p>'));
    li.append($('<div></div>', {class: 'clear'}));
    parent.append(li);
  }

  function showError(msg) {
    console.error(msg);
    $('#error').text(msg);
  }


  // DOM handling:
  //
  $('ul').on('click', '.product button', function() {
    var id = $(this).data('productId');
    var prod = $(this).data('product');
    console.log('purchasing', prod.name, id);

    fxpay.purchase(id, {
      oncheckpayment: function() {
        // TODO: update the UI here with a spinner or something.
        console.log('checking for payment');
      },
      onpurchase: function(err) {
        if (err) {
          return showError(err);
        }
        $('#your-products ul li.placeholder').remove();
        addProduct($('#your-products ul'), id, prod, {showBuy: false});
      },
      apiUrlBase: apiUrlBase
    });
  });

  $('#api-server').change(function(evt) {
    setApiServer();
  });


  // Startup
  //
  console.log('example app startup');
  setApiServer();
  var ul = $('#products ul');
  for (var prodID in products) {
    var prod = products[prodID];
    addProduct(ul, prodID, prod);
  }
});
