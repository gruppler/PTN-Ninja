// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

if ('serviceWorker' in navigator) {
  console.log('CLIENT: service worker registration in progress.');
  navigator.serviceWorker.register('../serviceworker.js').then(function() {
    console.log('CLIENT: service worker registration complete.');
  }, function() {
    console.log('CLIENT: service worker registration failure.');
  });
} else {
  console.log('CLIENT: service worker is not supported.');
}

requirejs.config({
  baseUrl: 'js/lib',
  paths: {
    'app': '../app',
    'nls': '../app/nls',
    'lodash': 'lodash.min',
    'jquery': 'jquery.min',
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
