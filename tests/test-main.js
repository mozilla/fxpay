var tests = [];
for (var file in window.__karma__.files) {
  if (window.__karma__.files.hasOwnProperty(file)) {
    if (/test-.*?\.js$/.test(file) && !/test-main\.js/.test(file)) {
      tests.push(file);
    }
  }
}

requirejs.config({
  // Karma serves files from '/base'
  baseUrl: '/base/lib/fxpay/',

  paths: {
    'helper': '../../tests/helper',
    'promise': '/base/lib/bower_components/es6-promise/promise',
  },

  // ask Require.js to load these files (all our tests)
  deps: tests,

  // start test run, once Require.js is done
  callback: window.__karma__.start
});
