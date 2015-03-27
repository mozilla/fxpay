var ghdeploy = require('./tasks/ghdeploy');


// List module files in order so that dependencies work right:
// TODO: use UMD for this.
// https://bugzilla.mozilla.org/show_bug.cgi?id=1137584
var libFiles = [
  __dirname + '/lib/bower_components/es6-promise/promise.js',
  __dirname + '/lib/fxpay/init_module.js',
  __dirname + '/lib/fxpay/errors.js',
  __dirname + '/lib/fxpay/utils.js',
  __dirname + '/lib/fxpay/settings.js',
  __dirname + '/lib/fxpay/api.js',
  __dirname + '/lib/fxpay/jwt.js',
  __dirname + '/lib/fxpay/pay.js',
  __dirname + '/lib/fxpay/products.js',
  __dirname + '/lib/fxpay/receipts.js',
  __dirname + '/lib/fxpay/adapter.js',
  __dirname + '/lib/fxpay/index.js',
];


module.exports = function(grunt) {
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
        files: libFiles.slice(0).concat([
          'tests/helper.js',
          // Allow an optional pattern for test files with --tests.
          {pattern: grunt.option('tests') || 'tests/test*.js',
           included: true}
        ]),
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

    uglify: {
      options: {
        sourceMap: true
      },
      minned: {
        files: {
          'build/lib/fxpay.min.js': 'build/lib/fxpay.debug.js',
        }
      },
      debug: {
        options: {
          beautify: {
            'beautify': true,
            'indent_level': 2
          },
          compress: false,
          mangle: false,
          preserveComments: true,
          sourceMap: false,
        },
        files: {
          'build/lib/fxpay.debug.js': libFiles,
        }
      }

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
      build: ['build/**/*', '!build/.gitkeep'],
      dist: ['dist/*', '!dist/.gitkeep'],
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
    }
  });

  // Always show stack traces when Grunt prints out an uncaught exception.
  grunt.option('stack', true);

  grunt.loadNpmTasks('grunt-bower-task');
  grunt.loadNpmTasks('grunt-banner');
  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-zip');

  grunt.registerTask('ghdeploy',
                     'publish example site to github pages',
                     ghdeploy.createTask(grunt, __dirname,
                                         {removeFiles: ['node_modules']}));
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
    'bower',
    'uglify:debug',
    'uglify:minned',
    'usebanner:chaff'
  ]);

  grunt.registerTask('test', ['jshint', 'compress', 'karma:run']);
  grunt.registerTask('release', ['clean', 'compress', 'copy:lib']);
  grunt.registerTask('default', 'test');
};
