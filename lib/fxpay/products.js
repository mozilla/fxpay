(function() {
  'use strict';

  var exports = fxpay.products = {};

  var errors = fxpay.getattr('errors');
  var settings = fxpay.getattr('settings');
  var utils = fxpay.getattr('utils');
  var API = fxpay.getattr('api').API;


  exports.get = function(productId, opt) {
    return buildProductReceiptMap()
      .then(function() {
        return new Promise(function(resolve, reject) {
          exports.getById(productId, function(error, product) {
            if (error) {
              settings.log.error(
                'no existing product with productId=' + productId +
                '; error: ' + error);
              return reject(error);
            }

            resolve(product);
          }, opt);
        });
      });
  };


  exports.all = function(callback) {
    settings.initialize();
    var promise = buildProductReceiptMap()
      .then(function() {
        return new Promise(function(resolve, reject) {
          var allProducts = [];

          var api = new API(settings.apiUrlBase);
          var origin = utils.getSelfOrigin();
          if (!origin) {
            return reject(
                errors.InvalidApp('an origin is needed to get products'));
          }
          origin = encodeURIComponent(origin);
          var url;

          if (settings.fakeProducts) {
            settings.log.warn('about to fetch fake products');
            url = '/payments/stub-in-app-products/';
          } else {
            settings.log.info('about to fetch real products for app',
                              origin);
            url = '/payments/' + origin + '/in-app/?active=1';
          }

          api.get(url, function(err, result) {
            if (err) {
              return reject(err);
            }
            if (!result || !result.objects) {
              settings.log.debug('unexpected API response', result);
              return reject(errors.BadApiResponse(
                                      'received empty API response'));
            }
            settings.log.info('total products fetched:', result.objects.length);
            for (var i=0; i < result.objects.length; i++) {
              var ob = result.objects[i];
              var productInfo = createProductFromApi(ob);
              allProducts.push(productInfo);
            }
            resolve(allProducts);
          });
        });
      });

    if (callback) {
      utils.logDeprecation(
        'getProducts(callback) is no longer supported; use the returned ' +
        'promise instead', '0.0.15');
      promise.then(function(products) {
        callback(null, products);
      }).catch(function(error) {
        callback(error, []);
      });
    }

    return promise;
  };


  exports.getById = function(productId, onFetch, opt) {
    opt = opt || {};
    if (typeof opt.fetchStubs === 'undefined') {
      opt.fetchStubs = false;
    }
    if (!opt.api) {
      opt.api = new API(settings.apiUrlBase);
    }
    var origin = encodeURIComponent(utils.getSelfOrigin());
    var url;

    if (opt.fetchStubs) {
      url = '/payments/stub-in-app-products/' + productId.toString() + '/';
    } else {
      url = '/payments/' + origin + '/in-app/' + productId.toString() + '/';
    }
    settings.log.info(
      'fetching product info at URL', url, 'fetching stubs?', opt.fetchStubs);

    opt.api.get(url, function(err, productData) {
      if (err) {
        settings.log.error('Error fetching product info', err.toString());
        return onFetch(err, {productId: productId});
      }
      onFetch(null, createProductFromApi(productData));
    });
  };


  function Product(params) {
    params = params || {};
    this.pricePointId = params.pricePointId;
    this.productId = params.productId;
    this.name = params.name;
    this.smallImageUrl = params.smallImageUrl;
    this.receiptInfo = params.receiptInfo || {};
  }

  exports.Product = Product;

  Product.prototype.getReceiptMap = function() {
    if (!settings.productReceiptMap) {
      // Sadly, building a receipt map must be done asynchronously so
      // we need to rely on a higher level function to set it up.
      throw errors.IncorrectUsage(
        'cannot proceed with this method; receipt map is empty');
    }
    return settings.productReceiptMap;
  };

  Product.prototype.hasReceipt = function() {
    return typeof this.getReceiptMap()[this.productId] !== 'undefined';
  };

  Product.prototype.validateReceipt = function() {
    var receiptMap = this.getReceiptMap();
    var product = this;
    var receipts = fxpay.getattr('receipts');

    return new Promise(function(resolve, reject) {

      var receipt = receiptMap[product.productId];
      if (!receipt) {
        return reject(errors.InvalidReceipt(
                        'could not find installed receipt for productId=' +
                        product.productId));
      }

      receipts.validateInAppProductReceipt(receipt, product,
                                           function(error, product) {
        if (error) {
          settings.log.error('receipt validation error: ' + error);
          error.productInfo = product;
          return reject(error);
        } else {
          return resolve(product);
        }
      });

    });
  };


  //
  // private functions:
  //


  function buildProductReceiptMap() {
    var receipts = fxpay.getattr('receipts');

    return new Promise(function(resolve, reject) {
      if (settings.productReceiptMap) {
        return resolve(settings.productReceiptMap);
      }

      settings.log.debug('building a product->receipt map');

      receipts.all(function(error, allReceipts) {
        if (error) {
          return reject(error);
        }

        settings.productReceiptMap = {};

        allReceipts.forEach(function(receipt) {
          var storedata = receipts.checkStoreData(receipt);
          if (!storedata) {
            settings.log.debug(
              'ignoring receipt with missing or unparsable storedata');
            return;
          }
          if (!storedata.inapp_id) {
            return settings.log.debug('ignoring receipt without inapp_id');
          }
          settings.log.debug('found receipt with inapp_id=',
                             storedata.inapp_id);
          settings.productReceiptMap[storedata.inapp_id] = receipt;
        });

        resolve(settings.productReceiptMap);
      });
    });
  }


  function createProductFromApi(ob) {
    return new Product({
      pricePointId: ob.price_id,
      productId: ob.guid,
      name: ob.name,
      smallImageUrl: ob.logo_url,
    });
  }


})();
