({
  appDir: '.',
  baseUrl: 'js/lib',
  dir: 'dist',
  optimizeCss: 'standard',
  removeCombined: true,
  modules: [{
    name: 'app'
  }],
  fileExclusionRegExp: /^\.|^push-to-prod\.sh$|^(app\.build|liga)\.js$|\.(map|scss|txt)$|demo/,
  paths: {
    'app': '../app',
    'nls': '../app/nls',
    'lodash': 'lodash.min',
    'jquery': 'jquery.min',
    'filesaver': 'FileSaver.min',
    'lzstring': 'lz-string.min'
  },
  stubModules: [
    'showdown',
    'mdown',
    'text'
  ]
})
