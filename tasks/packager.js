var fs = require('fs');

var shell = require('./shell');

var grunt;


exports.createTask = function(_grunt, workDir) {
  grunt = _grunt;
  return function() {
    run(this.async(), workDir);
  };
};


function run(done, workDir) {
  var pkgSrc = workDir + '/example/packaged';
  var buildDir = workDir + '/build';
  var pkgDir = buildDir + '/application';
  var pkgFile = pkgDir + '.zip';

  shell('rm', ['-fr', (pkgDir || '/__thank-me-later__') + '*'], function() {
    shell('cp', ['-R', pkgSrc + '/', pkgDir + '/'], function() {
      shell('cp', ['-R', workDir + '/example/shared/*',
                   pkgDir + '/'], function() {
        // Copy minified fxpay.js and source map into the package root.
        shell('cp', [workDir + '/build/fxpay.min.js*',
                     pkgDir + '/'], function() {
          process.chdir(pkgDir);
          shell('zip', ['-Xr', pkgFile, './*'], function() {
            grunt.log.writeln('Package folder: ' + pkgDir);
            grunt.log.writeln('Package: ' + pkgFile);
            done();
          });
        });
      });
    });
  });
};
