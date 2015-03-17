describe('fxpay.getProducts()', function() {
  var utils = fxpay.getattr('utils');

  beforeEach(function() {
    helper.setUp();
    fxpay.configure({
      appSelf: helper.appSelf
    });
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('resolves promise with product info', function(done) {

    var prodHelper = new ProductHelper();
    var serverObjects = prodHelper.serverObjects;

    fxpay.getProducts().then(function(products) {
      assert.equal(products[0].name, serverObjects[0].name);
      assert.equal(products[0].productId, serverObjects[0].guid);
      assert.equal(products[0].smallImageUrl, serverObjects[0].logo_url);
      assert.equal(products[0].pricePointId, serverObjects[0].price_id);
      assert.equal(products[1].name, serverObjects[1].name);
      assert.equal(products[1].productId, serverObjects[1].guid);
      assert.equal(products[1].smallImageUrl, serverObjects[1].logo_url);
      assert.equal(products[1].pricePointId, serverObjects[1].price_id);
      assert.equal(products.length, 2);
      done();
    }).catch(done);

    prodHelper.finish();
  });

  it('still supports old callback interface', function(done) {

    var prodHelper = new ProductHelper();
    var serverObjects = prodHelper.serverObjects;

    fxpay.getProducts(function(error, products) {
      assert.equal(products[0].name, serverObjects[0].name);
      done(error);
    });

    prodHelper.finish();
  });

  it('can retrieve fake products', function(done) {

    fxpay.configure({fakeProducts: true});

    var prodHelper = new ProductHelper({
      serverObjects: [
        {"guid": "guid1", "app": "fxpay", "price_id": 1,
         "name": "Clown Shoes", "logo_url": "http://site/image1.png"},
        {"guid": "guid2", "app": "fxpay", "price_id": 2,
         "name": "Belt and Suspenders", "logo_url": "http://site/image2.png"}
      ],
      url: helper.settings.apiUrlBase + helper.settings.apiVersionPrefix +
               '/payments/stub-in-app-products/',
    });

    fxpay.getProducts().then(function(products) {
      assert.equal(products[0].name, prodHelper.serverObjects[0].name);
      assert.equal(products[1].name, prodHelper.serverObjects[1].name);
      assert.equal(products.length, 2);
      done();
    }).catch(done);

    prodHelper.finish();
  });

  it('calls back with API errors', function(done) {

    helper.server.respondWith('GET', /.*/, [404, {}, '']);

    fxpay.getProducts().then(function() {
      done(Error('unexpected success'));
    }).catch(function(err) {
      assert.instanceOf(err, fxpay.errors.BadApiResponse);
      done();
    }).catch(done);

    helper.server.respond();
  });

  it('still supports callback interface for errors', function(done) {

    helper.server.respondWith('GET', /.*/, [404, {}, '']);

    fxpay.getProducts(function(error, products) {
      assert.instanceOf(error, fxpay.errors.BadApiResponse);
      assert.equal(products.length, 0);
      done();
    });

    helper.server.respond();
  });

  it('requires an origin when running as an app', function(done) {
    fxpay.configure({appSelf: {}});  // no origin

    fxpay.getProducts().then(function() {
      done(Error('unexpected success'));
    }).catch(function(err) {
      assert.instanceOf(err, fxpay.errors.InvalidApp);
      done();
    }).catch(done);
  });


  function ProductHelper(opt) {
    opt = utils.defaults(opt, {
      serverObjects: [
        {"guid": "guid3", "app": "fxpay", "price_id": 237,
         "name": "Virtual Kiwi", "logo_url": "http://site/image1.png"},
        {"guid": "guid4", "app": "fxpay", "price_id": 238,
         "name": "Majestic Cheese", "logo_url": "http://site/image2.png"}
      ],
      url: helper.settings.apiUrlBase + helper.settings.apiVersionPrefix +
               '/payments/' + encodeURIComponent(helper.someAppOrigin) +
               '/in-app/?active=1',
    });

    this.serverObjects = opt.serverObjects;
  }

  ProductHelper.prototype.finish = function() {
    helper.server.respondWith(
      'GET', this.url,
      [200, {"Content-Type": "application/json"},
      JSON.stringify({
        "meta": {"next": null, "previous": null,
                 "total_count": this.serverObjects.length,
                 "offset": 0, "limit": 25},
        "objects": this.serverObjects
      })]);

    helper.server.respond();
  };

});
