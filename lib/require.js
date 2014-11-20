// This is a super small shim that provides require-like features for the
// browser but without a whole pile of code that we don't need.

if (typeof window.require !== 'function') {
  window.require = function require(modulePath) {

    // Check that 'some/module/foo' exists as window.some.module.foo
    // and return it.

    var parts = modulePath.split('/');
    var topModule = window;
    var module;
    var trail = '';
    for (var i = 0; i < parts.length; i++) {
      if (trail === '') {
        trail = parts[i];
      } else {
        trail += '.' + parts[i];
      }
      module = topModule[parts[i]];
      if (typeof module === 'undefined') {
        throw new Error('The required module "' + modulePath + '" is not ' +
                        'defined as a global. First undefined ' +
                        'part: "' + trail + '"');
      }
      topModule = module;
    }

    return module;
  };
}
