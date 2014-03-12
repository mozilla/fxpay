var fs = require('fs');
var proc = require('child_process');
var grunt;


exports.createTask = function(_grunt, siteDir, repoDir) {
  grunt = _grunt;
  return function() {
    run(this.async(), siteDir, repoDir);
  };
};


function run(done, siteDir, repoDir) {
  function doUpdate() {
    updatePages(siteDir, repoDir, done);
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
  process.chdir(dest);
  grunt.log.writeln('pulling gh-pages changes in', dest);
  shell('git', ['checkout', 'gh-pages'], function() {
    shell('git', ['pull'], function() {
      callback(dest);
    });
  });
}


function updatePages(siteDir, repoDir, done) {
  removeAll(repoDir, function() {
    shell('cp', ['-r', siteDir + '/*', repoDir + '/'], function() {
      addAll(repoDir, function() {
        process.chdir(repoDir);
        shell('git', ['status', '-s'], function(out) {
          if (out) {
            shell('git', ['commit', '-m', 'deploy'], function() {
              grunt.log.writeln('pushing gh-pages deploy');
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
    });
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
  process.chdir(inDir);
  fs.readdir('.', function(err, files) {
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
      shell('git', ['rm', '-rf'].concat(files), function() {
        callback();
      });
    } else {
      callback();
    }
  });
};
