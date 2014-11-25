describe('fxpay.utils.defaults()', function() {

  it('defaults should handle merging defaults into object', function() {
    var obj = {
      bar: false,
      foo: 'something',
    };
    var defaults  = {
      bar: true,
      newKey: 'new-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: false,
      foo: 'something',
      newKey: 'new-thing',
    });
  });

  it('defaults should handle merging defaults into empty object', function() {
    var obj = {};
    var defaults  = {
      bar: true,
      newKey: 'new-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: true,
      newKey: 'new-thing',
    });
  });

  it('defaults should not override existing props', function() {
    var obj  = {
      bar: true,
      newKey: 'new-thing'
    };
    var defaults  = {
      bar: false,
      newKey: 'other-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: true,
      newKey: 'new-thing',
    });
  });

  it('defaults should not override null', function() {
    var obj  = {
      bar: null,
      newKey: 'new-thing'
    };
    var defaults  = {
      bar: false,
      newKey: 'other-thing'
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: null,
      newKey: 'new-thing',
    });
  });

  it('defaults should override undefined', function() {
    var obj  = {
      bar: undefined,
    };
    var defaults  = {
      bar: false,
    };
    var result = fxpay.utils.defaults(obj, defaults);
    assert.deepEqual(result, {
      bar: false,
    });
  });
});



describe('fxpay.utils.openWindow()', function() {

  beforeEach(function(){
    window._oldOpen = window.open;
    window.open = sinon.spy();
  });

  afterEach(function(){
    window.open = window._oldOpen;
  });

  it('Open window is called with props', function() {
    fxpay.utils.openWindow({
      url: 'http://blah.com',
      title: 'whatever',
      w: 200,
      h: 400
    });
    assert(window.open.calledWithMatch('http://blah.com', 'whatever'));
    assert.include(window.open.args[0][2], 'width=200');
    assert.include(window.open.args[0][2], 'height=400');
  });

  it('Test that window open is called with defaults', function() {
    fxpay.utils.openWindow();
    assert(window.open.calledWithMatch('about:blank', 'FxPay'));
    assert.include(window.open.args[0][2], 'width=276');
    assert.include(window.open.args[0][2], 'height=384');
  });

  it('Test that features string has no whitespace', function() {
    fxpay.utils.openWindow();
    assert.notInclude(window.open.args[0][2], ' ');
  });
});
