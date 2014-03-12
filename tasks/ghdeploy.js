var fs = require('fs');
var proc = require('child_process');

var async = require('async');

var grunt;


exports.createTask = function(_grunt, siteDir, repoDir, opt) {
  opt = opt || {};
  opt.copyFiles = opt.copyFiles || undefined;
  opt.removeFiles = opt.removeFiles || undefined;

  grunt = _grunt;
  return function() {
    run(this.async(), siteDir, repoDir, opt);
  };
};


function run(done, siteDir, repoDir, opt) {
  opt = opt || {};
  opt.copyFiles = opt.copyFiles || undefined;

  function doUpdate() {
    updatePages(siteDir, repoDir, done, opt);
  }
  fs.exists(repoDir, function(exists) {
    if (!exists) {
      fs.mkdir(repoDir, function(err) {
        if (err) {
          throw err;
        }
        cloneRepo(repoDir, doUpdate);
      });
    } else {
      syncRepo(repoDir, doUpdate);
    }
  });
};


function shell(cmd, args, callback) {
  proc.exec(cmd + ' ' + args.join(' '),
            function(err, stdout, stderr) {
    if (err) {
      grunt.log.writeln('Ran:', cmd, args);
      grunt.log.writeln('output', stderr, stdout);
      throw err;
    }
    callback(stdout);
  });
}


function getOrigin(callback) {
  shell('git', ['remote', '-v'], function(out) {
    var origin;
    out.toString().split('\n').forEach(function(ln) {
      var m;
      var parts = ln.split('\t');
      if (parts[0] === 'origin') {
        m = parts[1].match(/([^\s]+)\s\(fetch\)/);
        if (m) {
          origin = m[1];
        }
      }
    });
    if (!origin) {
      throw 'could not find a remote origin for fetching';
    }
    callback(origin);
  });
}


function cloneRepo(dest, callback) {
  getOrigin(function(origin) {
    grunt.log.writeln('Cloning gh-pages branch from', origin,
                      'into', dest);
    shell('git', ['clone', '-b', 'gh-pages', origin, dest], function(out) {
      callback(dest);
    });
  });
}


function syncRepo(dest, callback) {
  grunt.log.writeln('pulling gh-pages changes in', dest);
  process.chdir(dest);
  shell('git', ['checkout', 'gh-pages'], function() {
    process.chdir(dest);
    shell('git', ['pull'], function() {
      callback(dest);
    });
  });
}


function copySiteFiles(siteDir, repoDir, done, opt) {
  opt = opt || {};
  opt.copyFiles = opt.copyFiles || {};
  opt.removeFiles = opt.removeFiles || [];

  shell('cp', ['-r', siteDir + '/*', repoDir + '/'], function() {
    var removes = [];
    opt.removeFiles.forEach(function(fn) {
      removes.push(function(callback) {
        var fullFn = repoDir + '/' + fn;
        grunt.log.writeln('Removing:', fullFn);
        shell('rm', ['-rf', fullFn], callback)
      });
    });
    async.parallel(removes, function(err) {
      if (err) {
        throw err;
      }

      var copies = [];
      Object.keys(opt.copyFiles).forEach(function(k) {
        var src = k;
        var dest = repoDir + '/' + opt.copyFiles[k];
        copies.push(function(callback) {
          shell('cp', [src, dest], callback)
        });
      });
      async.parallel(copies, function(err) {
        if (err) {
          throw err;
        }
        done();
      });
    });
  });
}


function updatePages(siteDir, repoDir, done, opt) {
  opt = opt || {};
  opt.copyFiles = opt.copyFiles || undefined;
  opt.removeFiles = opt.removeFiles || undefined;

  removeAll(repoDir, function() {
    copySiteFiles(siteDir, repoDir, function() {
      addAll(repoDir, function() {
        process.chdir(repoDir);
        shell('git', ['status', '-s'], function(out) {
          if (out) {
            process.chdir(repoDir);
            shell('git', ['commit', '-a', '-m', 'deploy'], function() {
              grunt.log.writeln('pushing gh-pages changes');
              process.chdir(repoDir);
              shell('git', ['push'], function() {
                done();
              })
            });
          } else {
            grunt.log.writeln('No files to commit in', repoDir);
            done();
          }
        });
      });
    }, opt);
  });
}


function addAll(repoDir, callback) {
  iterFiles(repoDir, function(files) {
    if (files.length) {
      shell('git', ['add'].concat(files), function() {
        callback();
      });
    } else {
      callback();
    }
  });
}


function iterFiles(inDir, callback) {
  fs.readdir(inDir, function(err, files) {
    if (err) {
      throw err;
    }
    var visible = [];
    files.forEach(function(fn) {
      if (fn.slice(0, 1) !== '.') {
        visible.push(fn);
      }
    });
    callback(visible);
  });
}


function removeAll(repoDir, callback) {
  iterFiles(repoDir, function(files) {
    if (files.length) {
      process.chdir(repoDir);
      shell('rm', ['-rf'].concat(files), function() {
        callback();
      });
    } else {
      callback();
    }
  });
};
