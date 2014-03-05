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

    mochaTest: {
      test: {
        options: {
          reporter: 'spec'
        },
        src: ['tests/test*.js']
      }
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
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.registerTask('compress', 'uglify');
  grunt.registerTask('unittest', 'mochaTest');
  grunt.registerTask('test', ['jshint', 'mochaTest']);
  grunt.registerTask('default', 'test');
};
