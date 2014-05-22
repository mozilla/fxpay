var fs = require('fs');

var shell = require('./shell');

var grunt;


exports.createTask = function(_grunt, siteDir) {
  grunt = _grunt;
  return function() {
    run(this.async(), siteDir);
  };
};


function run(done, siteDir) {
  var workDir = process.cwd();
  var buildDir = workDir + '/build';
  var pkgDir = buildDir + '/application';
  var pkgFile = pkgDir + '.zip';

  shell('rm', ['-fr', pkgDir + '*'], function() {
    shell('cp', ['-R', siteDir + '/', pkgDir], function() {
      // Copy fxpay.js into the package root.
      shell('cp', [workDir + '/lib/fxpay.js',
                   pkgDir + '/fxpay.js'], function() {
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
