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
  },
  shim: {
    'bililiteRange.undo': {
      deps: ['bililiteRange']
    },
    'bililiteRange.fancytext': {
      deps: ['bililiteRange']
    }
  }
});

requirejs(['app/main']);
