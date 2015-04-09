var path = require('path');

module.exports = function(grunt) {
  var testOption = grunt.option('tests');

  var nodeModulesPath = __dirname + '/node_modules';
  var almondPath = nodeModulesPath + '/almond/almond.js';
  var almondInclude = path.relative(
    __dirname + '/lib/fxpay', almondPath).replace(/\.js$/, '');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      options: { jshintrc: __dirname + '/.jshintrc' },
      files: [
        'Gruntfile.js',
        'lib/*.js',
        'lib/*/*.js',
        'tests/*.js',
      ],
    },

    karma: {
      options: {
        files: [
          'tests/test-main.js',
          {pattern: 'lib/fxpay/*.js', included: false},
          {pattern: 'tests/helper.js', included: false},
          {pattern: testOption || 'tests/test*.js', included: false},
          {pattern: 'lib/bower_components/es6-promise/promise.js',
           included: false}
        ],
        logLevel: grunt.option('log-level') || 'ERROR',
      },
      dev: {
        configFile: 'karma.conf.js',
        autoWatch: true
      },
      run: {
        configFile: 'karma.conf.js',
        singleRun: true
      },
    },

    usebanner: {
      chaff: {
        options: {
          position: 'top',
          banner: ")]}'",
          linebreak: true
        },
        files: {
          src: ['build/lib/fxpay.min.js.map']
        }
      }
    },

    bower: {
      default: {
        options: {
          targetDir: './lib/bower_components',
          layout: 'byType',
          bowerOptions: {
            // Do not install project devDependencies
            production: true,
          }
        }
      }
    },

    bump: {
      options: {
        // The pattern 'version': '..' will be updated in all these files.
        files: ['bower.json', 'lib/fxpay/settings.js', 'package.json'],
        commit: false,
        createTag: false,
        push: false,
      }
    },

    clean: {
      build: [
        'build/**/*',
        '!build/.gitkeep'
      ],
      dist: [
        'dist/*',
        '!dist/.gitkeep'
      ],
    },

    copy: {
      lib: {
        cwd: 'build/lib/',
        src: ['*.js', '*.map'],
        dest: 'dist/',
        filter: 'isFile',
        expand: true,
      },
      'example-packaged': {
        cwd: 'example/packaged/',
        src: '*',
        dest: 'build/app/',
        expand: true,
      },
      'example-shared': {
        cwd: 'example/shared/',
        src: '**/*',
        dest: 'build/app/',
        expand: true,
      },
      'lib-to-package': {
        cwd: 'build/lib/',
        src: '*',
        dest: 'build/app/',
        expand: true,
      }
    },

    zip: {
      app: {
        cwd: 'build/app/',
        src: 'build/app/**',
        dest: 'build/app.zip',
        compression: 'DEFLATE',
      }
    },

    jsdoc : {
      docs: {
        src: ['lib/fxpay/*.js'],
        options: {
          destination: 'build/docs',
          template: 'node_modules/jsdoc-simple-template',
          readme: 'README.md',
          configure: 'jsdoc.conf.json',
        },
      }
    },

    'gh-pages': {
      options: {
        base: 'build/docs',
        message: 'Updating docs',
        repo: 'git@github.com:mozilla/fxpay.git'
      },
      src: ['**']
    },

    // Builds an unminned optimized combined
    // library file.
    requirejs: {
      debug: {
        options: {
          include: [almondInclude],
          findNestedDependencies: true,
          name: 'fxpay',
          optimize: 'none',
          out: 'build/lib/fxpay.debug.js',
          baseUrl: 'lib/fxpay',
          normalizeDirDefines: 'all',
          skipModuleInsertion: true,
          paths: {
            promise: '../bower_components/es6-promise/promise',
          },
          wrap: {
            start: grunt.file.read('umd/start.frag'),
            end: grunt.file.read('umd/end.frag')
          },
        }
      }
    },

    // Takes the requirejs optimized debug file
    // and compresses it and creates the sourcemap.
    uglify: {
      options: {
        sourceMap: true
      },
      minned: {
        files: {
          'build/lib/fxpay.min.js': 'build/lib/fxpay.debug.js',
        }
      }
    },

    fileExists: {
      almond: {
        src: [almondPath],
        errorMessage: 'Please run npm install first',
      }
    }

  });

  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-banner');
  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-gh-pages');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-zip');

  grunt.registerMultiTask('fileExists', 'Check files are present', function (){
    var files = grunt.file.expand({
      nonull: true
    }, this.data.src);
    var len = files.length;
    grunt.log.writeln(
      'Checking existence of %d file%s', len, (len === 1 ? '' : 's'));
    var filesExist = files.every(function (file) {
      grunt.verbose.writeln('Checking file: %s', file);
      var fileExists = grunt.file.exists(file);
      if (!fileExists) {
        grunt.log.error("%s doesn't exist", file);
      }
      return fileExists;
    });
    if (filesExist) {
      grunt.log.ok();
    } else {
      var errorMessage = this.data.errorMessage;
      if (errorMessage) {
        grunt.log.error(errorMessage);
      }
    }
    return filesExist;
  });

  grunt.registerTask('package', [
    'clean:build',
    'compress',
    'copy:example-packaged',
    'copy:example-shared',
    'copy:lib-to-package',
    'zip',
  ]);

  // The `compress` step builds a debug version first and then uses that as
  // the source for the minified version.
  grunt.registerTask('compress', [
    'fileExists:almond',
    'bower',
    'requirejs',
    'uglify:minned',
    'usebanner:chaff'
  ]);

  grunt.registerTask('publish-docs', ['docs', 'gh-pages']);
  grunt.registerTask('test', ['jshint', 'karma:run']);
  grunt.registerTask('release', ['clean', 'compress', 'copy:lib']);
  grunt.registerTask('docs', ['clean:build', 'jsdoc']);
  grunt.registerTask('default', 'test');
};
