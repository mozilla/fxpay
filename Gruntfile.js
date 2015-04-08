module.exports = function(grunt) {
  var testOption = grunt.option('tests');

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
          'build/lib/fxpay.debug.js': 'lib/**/*.js',
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
  grunt.loadNpmTasks('grunt-gh-pages');
  grunt.loadNpmTasks('grunt-jsdoc');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-zip');

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

  grunt.registerTask('publish-docs', ['docs', 'gh-pages']);
  grunt.registerTask('test', ['jshint', 'karma:run']);
  grunt.registerTask('release', ['clean', 'compress', 'copy:lib']);
  grunt.registerTask('docs', ['clean:build', 'jsdoc']);
  grunt.registerTask('default', 'test');
};
