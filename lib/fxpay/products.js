(function() {
  'use strict';

  var exports = fxpay.products = {};

  var errors = fxpay.getattr('errors');
  var settings = fxpay.getattr('settings');
  var utils = fxpay.getattr('utils');
  var API = fxpay.getattr('api').API;

  exports.all = function products_all(callback) {
    var promise = new Promise(function(resolve, reject) {
      var allProducts = [];

      var api = new API(settings.apiUrlBase);
      var origin = utils.getSelfOrigin();
      if (!origin) {
        return reject(errors.InvalidApp('an origin is needed to get products'));
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
        settings.log.info('total products fetched:', result.objects.length);
        for (var i=0; i < result.objects.length; i++) {
          var ob = result.objects[i];
          var productInfo = expandInfo(ob);
          allProducts.push(productInfo);
        }
        resolve(allProducts);
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


  exports.getById = function products_getById(productId, onFetch, opt) {
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
        settings.log.error('Error fetching product info', err);
        return onFetch(err, {productId: productId});
      }
      onFetch(null, expandInfo(productData));
    });
  };


  //
  // private functions:
  //


  function expandInfo(ob) {
    return {
      pricePointId: ob.price_id,
      productId: ob.guid,
      name: ob.name,
      smallImageUrl: ob.logo_url
    };
  }


})();
