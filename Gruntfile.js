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
      unit: {
        configFile: 'karma.conf.js',
        autoWatch: true
      },
      ci: {
        configFile: 'karma.conf.js',
        singleRun: true,
        browsers: ['PhantomJS']
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

  grunt.registerTask('compress', 'uglify');
  grunt.registerTask('test', ['jshint', 'karma:ci']);
  grunt.registerTask('default', 'test');
};
