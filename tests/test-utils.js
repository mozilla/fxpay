describe('fxpay.utils.defaults()', function() {

  it('should handle merging defaults into object', function() {
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

  it('should handle merging defaults into empty object', function() {
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

  it('should not override existing props', function() {
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

  it('should not override null', function() {
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

  it('should override an undefined property', function() {
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

  it('should handle the object being undefined', function() {
    var defaults  = {
      bar: 'result',
    };
    var result = fxpay.utils.defaults(undefined, defaults);
    assert.deepEqual(result, {
      bar: 'result',
    });
  });
});



describe('fxpay.utils.openWindow()', function() {

  beforeEach(function(){
    this._oldOpen = window.open;
    window.open = sinon.spy();
  });

  afterEach(function(){
    window.open = this._oldOpen;
  });

  it('should be called with props', function() {
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

  it('should be called with defaults', function() {
    fxpay.utils.openWindow();
    assert(window.open.calledWithMatch('about:blank', 'FxPay'));
    assert.include(window.open.args[0][2], 'width=276');
    assert.include(window.open.args[0][2], 'height=384');
  });

  it('should be passed a features string with no whitespace', function() {
    fxpay.utils.openWindow();
    assert.notInclude(window.open.args[0][2], ' ');
  });
});
