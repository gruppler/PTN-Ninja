({
  appDir: '.',
  baseUrl: 'js/lib',
  dir: 'dist',
  optimizeCss: 'standard',
  removeCombined: true,
  modules: [{
    name: 'app'
  }],
  fileExclusionRegExp: /^\.|^(app\.build|liga)\.js$|\.(map|json|scss|txt)$|demo/,
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
  }
})
