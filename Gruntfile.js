var ghdeploy = require('./tasks/ghdeploy');
var packager = require('./tasks/packager');


// List module files in order so that calls to require() work right:
var libFiles = [
  __dirname + '/lib/require.js',
  __dirname + '/lib/fxpay/utils.js',
  __dirname + '/lib/fxpay/settings.js',
  __dirname + '/lib/fxpay/api.js',
  __dirname + '/lib/fxpay/pay.js',
  __dirname + '/lib/fxpay/products.js',
  __dirname + '/lib/fxpay/receipts.js',
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
      my_target: {
        files: {
          'build/fxpay.min.js': libFiles,
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
  });

  // Always show stack traces when Grunt prints out an uncaught exception.
  grunt.option('stack', true);

  grunt.loadNpmTasks('grunt-bump');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('ghdeploy',
                     'publish example site to github pages',
                     ghdeploy.createTask(grunt, __dirname,
                                         {removeFiles: ['node_modules']}));

  var siteDir = __dirname + '/example';
  grunt.registerTask('package',
                     'create a packaged example app',
                     packager.createTask(grunt, siteDir));

  grunt.registerTask('compress', 'uglify');
  grunt.registerTask('test', ['jshint', 'compress', 'karma:run']);
  grunt.registerTask('default', 'test');
};
