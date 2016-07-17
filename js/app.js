// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

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
    'slideout': 'slideout.min',
    'filesaver': 'FileSaver.min',
    'lzstring': 'lz-string.min'
  },
  shim: {
    'bililiteRange.undo': {
      deps: ['bililiteRange']
    },
    'bililiteRange.fancytext': {
      deps: ['bililiteRange']
    },
    'jquery.keymap': {
      deps: ['jquery']
    }
  }
});

requirejs(['app/main']);
