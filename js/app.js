'use strict';

requirejs.config({
  baseUrl: 'js/lib',
  paths: {
    'app': '../app',
    'model': '../app/model',
    'view': '../app/view',
    'util': '../app/util',
    'nls': '../app/nls',
    'lodash': 'lodash.min',
    'jquery': 'jquery.min',
    'lzstring': 'lz-string.min'
  }
});

requirejs(['app/main']);
