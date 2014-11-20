var fs = require('fs');

var shell = require('./shell');

var grunt;


exports.createTask = function(_grunt, siteDir) {
  grunt = _grunt;
  return function() {
    grunt.task.run('compress');
    run(this.async(), siteDir);
  };
};


function run(done, siteDir) {
  var workDir = process.cwd();
  var buildDir = workDir + '/build';
  var pkgDir = buildDir + '/application';
  var pkgFile = pkgDir + '.zip';

  shell('rm', ['-fr', (pkgDir || '/__thank-me-later__') + '*'], function() {
    shell('cp', ['-R', siteDir + '/', pkgDir], function() {
      // Copy minified fxpay.js into the package root.
      shell('cp', [workDir + '/build/fxpay.min.js',
                   pkgDir + '/fxpay.min.js'], function() {
        process.chdir(pkgDir);
        shell('zip', ['-Xr', pkgFile, './*'], function() {
          grunt.log.writeln('Package folder: ' + pkgDir);
          grunt.log.writeln('Package: ' + pkgFile);
          done();
        });
      });
    });
  });
};
