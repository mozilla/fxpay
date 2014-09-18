describe('fxpay.getProducts()', function() {

  beforeEach(function() {
    helper.setUp();
    fxpay.configure({
      appSelf: helper.appSelf
    });
  });

  afterEach(function() {
    helper.tearDown();
  });

  it('calls back with product info', function(done) {

    var serverObjects = [
      {"guid": "guid3", "app": "fxpay", "price_id": 237,
       "name": "Virtual Kiwi", "logo_url": "http://site/image1.png"},
      {"guid": "guid4", "app": "fxpay", "price_id": 238,
       "name": "Majestic Cheese", "logo_url": "http://site/image2.png"}
    ];
    var url = (helper.settings.apiUrlBase + helper.settings.apiVersionPrefix +
               '/payments/' + encodeURIComponent(helper.someAppOrigin) +
               '/in-app/?active=1');

    helper.server.respondWith(
      'GET', url,
      [200, {"Content-Type": "application/json"},
       JSON.stringify({
         "meta": {"next": null, "previous": null, "total_count": 2,
                  "offset": 0, "limit": 25},
         "objects": serverObjects
       })]);

    fxpay.getProducts(function(err, products) {
      assert.equal(products[0].name, serverObjects[0].name);
      assert.equal(products[0].productId, serverObjects[0].guid);
      assert.equal(products[0].smallImageUrl, serverObjects[0].logo_url);
      assert.equal(products[1].name, serverObjects[1].name);
      assert.equal(products[1].productId, serverObjects[1].guid);
      assert.equal(products[1].smallImageUrl, serverObjects[1].logo_url);
      assert.equal(products.length, 2);
      done(err);
    });

    helper.server.respond();
  });

  it('can retrieve fake products', function(done) {

    fxpay.configure({fakeProducts: true});

    var serverObjects = [
      {"guid": "guid1", "app": "fxpay", "price_id": 1,
       "name": "Clown Shoes", "logo_url": "http://site/image1.png"},
      {"guid": "guid2", "app": "fxpay", "price_id": 2,
       "name": "Belt and Suspenders", "logo_url": "http://site/image2.png"}
    ];
    var url = (helper.settings.apiUrlBase + helper.settings.apiVersionPrefix +
               '/payments/stub-in-app-products/');

    helper.server.respondWith(
      'GET', url,
      [200, {"Content-Type": "application/json"},
       JSON.stringify({
         "meta": {"next": null, "previous": null, "total_count": 2,
                  "offset": 0, "limit": 25},
         "objects": serverObjects
       })]);

    fxpay.getProducts(function(err, products) {
      assert.equal(products[0].name, serverObjects[0].name);
      assert.equal(products[1].name, serverObjects[1].name);
      assert.equal(products.length, 2);
      done(err);
    });

    helper.server.respond();
  });

  it('calls back with API errors', function(done) {

    helper.server.respondWith('GET', /.*/, [404, {}, '']);

    fxpay.getProducts(function(err, products) {
      assert.equal(err, 'BAD_API_RESPONSE');
      assert.equal(products.length, 0);
      done();
    });

    helper.server.respond();
  });

  it('should pass through init errors', function (done) {
    // Trigger an init error:
    fxpay.configure({
      mozApps: {},  // invalid mozApps.
    });
    fxpay.init({
      onerror: function(err) {
        console.log('ignoring err', err);
      }
    });

    fxpay.getProducts(function(err, products) {
      assert.equal(err, 'PAY_PLATFORM_UNAVAILABLE');
      assert.equal(products.length, 0);
      done();
    });
  });
});
