/*   
 * @copyright 2014-2015 CoNWeT Lab., Universidad Politécnica de Madrid
 * @license Apache v2 (http://www.apache.org/licenses/)
 */

/*jshint node:true*/

module.exports = function(grunt) {

    'use strict';

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        banner: ' * @version <%= pkg.version %>\n' +
                ' * \n' +
                ' * @copyright 2014-2015 <%= pkg.author %>\n' +
                ' * @license <%= pkg.license.type %> (<%= pkg.license.url %>)\n' +
                ' */',

        bower: {
            install: {
                options: {
                    layout: function(type, component, source) {
                        return type;
                    },
                    targetDir: './src/lib'
                }
            }
        },

        compress: {
            widget: {
                options: {
                    mode: 'zip',
                    archive: 'build/<%= pkg.vendor %>_<%= pkg.name %>_<%= pkg.version %>-dev.wgt'
                },
                files: [
                    {
                        expand: true,
                        cwd: 'src',
                        src: [
                            'css/**/*',
                            'doc/**/*',
                            'images/**/*',
                            'js/**/*',
                            'lib/**/*',
                            'index.html',
                            'config.xml'
                        ]
                    }
                ]
            }
        },
        
        jasmine: {
            src: ['src/js/*.js'],
            options: {
                specs: 'src/test/js/*Spec.js',
                helpers: ['src/test/helpers/*.js'],
                vendor: [
                    'node_modules/jquery/dist/jquery.js',
                    'src/lib/js/jquery.dataTables.js',
                    'node_modules/jasmine-jquery/lib/jasmine-jquery.js'
                ]
            }
        },

        replace: {
            version: {
                overwrite: true,
                src: ['src/config.xml'],
                replacements: [{
                    from: /version=\"[0-9]+\.[0-9]+\.[0-9]+(-dev)?\"/g,
                    to: 'version="<%= pkg.version %>"'
                }]
            }
        },

        clean: ['build'],

        jshint: {
            options: {
                jshintrc: true
            },
            all: {
                files: {
                    src: ['src/js/**/*', 'src/test/**/*', 'Gruntfile.js', '!src/test/fixtures/']
                }
            }
        }

    });

    grunt.loadNpmTasks('grunt-bower-task');
    grunt.loadNpmTasks('grunt-contrib-jasmine');
    grunt.loadNpmTasks('grunt-text-replace');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-compress');

    grunt.registerTask('default', [
        'bower:install',
        'replace:version',
        'jshint',
        'compress:widget'
    ]);

};
