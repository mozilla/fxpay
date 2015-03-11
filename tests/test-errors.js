describe('fxpay.errors.createError()', function() {

  var errors = fxpay.getattr('errors');

  var FxPayError = errors.FxPayError;
  var createError = errors.createError;

  var CustomError = createError('MyError');
  var customError = CustomError();

  it('should create instances of Error', function() {
    assert.instanceOf(customError, Error);
  });

  it('should create instances of FxPayError', function() {
    assert.instanceOf(customError, FxPayError);
  });

  it('should set a custom name', function() {
    assert.equal(customError.name, 'MyError');
  });

  it('should stringify the class name', function() {
    assert.equal(CustomError().toString(), 'MyError');
  });

  it('should stringify with message', function() {
    assert.equal(CustomError('message').toString(),
                 'MyError: message');
  });

  it('should stringify with message and code', function() {
    assert.equal(CustomError('message', {code: 'A_CODE'}).toString(),
                 'MyError: message {code: A_CODE}');
  });

  it('should set a message', function() {
    assert.equal(CustomError('some message').message,
                 'some message');
  });

  it('should set a custom code', function() {
    assert.equal(CustomError('message', {code: 'CUSTOM_CODE'}).code,
                 'CUSTOM_CODE');
  });

  it('should set a default code', function() {
    var ErrorWithCode = createError('ErrorWithCode', {code: 'MY_CODE'});
    assert.equal(ErrorWithCode().code, 'MY_CODE');
  });

  it('should define a stack', function() {
    assert.ok(customError.stack);
  });

  it('should allow custom parents', function() {
    var SubError = createError('NewError', {inherits: CustomError});
    var subError = SubError();
    assert.instanceOf(subError, CustomError);
    assert.instanceOf(subError, FxPayError);
    assert.instanceOf(subError, Error);
  });

  it('should create PaymentFailed errors', function() {
    assert.instanceOf(errors.AppReceiptMissing(), errors.PaymentFailed);
    assert.instanceOf(errors.InvalidReceipt(), errors.PaymentFailed);
    assert.instanceOf(errors.PurchaseTimeout(), errors.PaymentFailed);
    assert.instanceOf(errors.TestReceiptNotAllowed(), errors.PaymentFailed);
  });

});
