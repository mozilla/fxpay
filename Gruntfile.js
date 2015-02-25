var ghdeploy = require('./tasks/ghdeploy');
var packager = require('./tasks/packager');


// List module files in order so that calls to require() work right:
var libFiles = [
  __dirname + '/lib/fxpay/init_module.js',
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
        ])
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
          'build/fxpay.min.js': 'build/fxpay.debug.js',
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
          'build/fxpay.debug.js': libFiles,
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
          src: ['build/fxpay.min.js.map']
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
        'build/*.js',
        'build/*.map',
        'dist/*.js',
        'dist/*.map'
      ],
    },

    copy: {
      main: {
        cwd: 'build/',
        src: ['*.js', '*.map'],
        dest: 'dist/',
        filter: 'isFile',
        expand: true,
      }
    },

  });

  // Always show stack traces when Grunt prints out an uncaught exception.
  grunt.option('stack', true);

  grunt.loadNpmTasks('grunt-banner');
  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('ghdeploy',
                     'publish example site to github pages',
                     ghdeploy.createTask(grunt, __dirname,
                                         {removeFiles: ['node_modules']}));

  grunt.registerTask('createpackage',
                     'create a packaged example app',
                     packager.createTask(grunt, __dirname));
  grunt.registerTask('package', ['compress', 'createpackage']);

  // The `compress` step builds a debug version first and then uses that as
  // the source for the minified version.
  grunt.registerTask('compress', [
    'uglify:debug', 'uglify:minned', 'usebanner:chaff']);
  grunt.registerTask('test', ['jshint', 'compress', 'karma:run']);
  grunt.registerTask('release', ['clean', 'compress', 'copy']);

  grunt.registerTask('default', 'test');
};
