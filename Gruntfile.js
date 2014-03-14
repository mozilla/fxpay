var ghdeploy = require('./tasks/ghdeploy');

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    jshint: {
      options: { jshintrc: __dirname + '/.jshintrc' },
      files: [
        'Gruntfile.js',
        'lib/*.js',
        'test/*.js',
      ],
    },

    karma: {
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
          'build/fxpay.min.js': ['lib/fxpay.js']
        }
      }
    }
  });

  // Always show stack traces when Grunt prints out an uncaught exception.
  grunt.option('stack', true);

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  var siteDir = __dirname + '/example';
  var repoDir = __dirname + '/.ghpages';
  var copyFiles = {};
  copyFiles[__dirname + '/lib/fxpay.js'] = 'fxpay.js';
  grunt.registerTask('ghdeploy',
                     'publish example site to github pages',
                     ghdeploy.createTask(grunt, siteDir, repoDir,
                                         {copyFiles: copyFiles,
                                          removeFiles: ['node_modules']}));

  grunt.registerTask('compress', 'uglify');
  grunt.registerTask('test', ['jshint', 'karma:run']);
  grunt.registerTask('default', 'test');
};
