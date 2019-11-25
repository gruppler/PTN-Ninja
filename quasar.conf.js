// Configuration for your app

module.exports = function(ctx) {
  return {
    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    boot: [
      "addressbar-color",
      "axios",
      "i18n",
      "moment",
      "shortkey",
      "globalComponents"
    ],

    css: ["app.styl"],

    extras: ["roboto-font", "material-icons"],

    framework: {
      // all: true, // --- includes everything; for dev only!

      components: [
        "QAvatar",
        "QBadge",
        "QBtn",
        "QBtnDropdown",
        "QBtnGroup",
        "QCard",
        "QCardActions",
        "QCardSection",
        "QChatMessage",
        "QChip",
        "QDate",
        "QDialog",
        "QDrawer",
        "QExpansionItem",
        "QFab",
        "QFabAction",
        "QFooter",
        "QForm",
        "QHeader",
        "QIcon",
        "QInnerLoading",
        "QInput",
        "QItem",
        "QItemLabel",
        "QItemSection",
        "QLayout",
        "QLinearProgress",
        "QList",
        "QMenu",
        "QPage",
        "QPageContainer",
        "QPageSticky",
        "QPopupEdit",
        "QPopupProxy",
        "QResizeObserver",
        "QScrollArea",
        "QSelect",
        "QSeparator",
        "QSlider",
        "QTab",
        "QTabPanel",
        "QTabPanels",
        "QTabs",
        "QTime",
        "QToggle",
        "QToolbar",
        "QToolbarTitle"
      ],

      directives: [
        "ClosePopup",
        "Ripple",
        "TouchPan"
      ],

      // Quasar plugins
      plugins: [
        "AddressbarColor",
        "AppFullscreen",
        "BottomSheet",
        "Loading",
        "LocalStorage",
        "Notify"
      ]

      // iconSet: 'ionicons-v4'
      // lang: 'de' // Quasar language
    },

    supportIE: false,

    build: {
      scopeHoisting: true,
      // vueRouterMode: 'history',
      // vueCompiler: true,
      // gzip: true,
      // analyze: true,
      // extractCSS: false,
      extendWebpack(cfg) {
        cfg.module.rules.push({
          enforce: "pre",
          test: /\.(js|vue)$/,
          loader: "eslint-loader",
          exclude: /node_modules/
        });
      }
    },

    devServer: {
      // https: true,
      // port: 8080,
      open: false // opens browser window automatically
    },

    // animations: 'all', // --- includes all animations
    animations: [],

    ssr: {
      pwa: false
    },

    pwa: {
      workboxPluginMode: "GenerateSW",
      workboxOptions: {
        skipWaiting: true,
        clientsClaim: true
      },
      manifest: {
        name: "PTN Ninja",
        short_name: "PTN-Ninja",
        description: "An editor and viewer for Portable Tak Notation",
        display: "standalone",
        orientation: "portrait",
        background_color: "#607d8b",
        theme_color: "#263238",
        icons: [
          {
            src: "statics/icons/icon-128x128.png",
            sizes: "128x128",
            type: "image/png"
          },
          {
            src: "statics/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "statics/icons/icon-256x256.png",
            sizes: "256x256",
            type: "image/png"
          },
          {
            src: "statics/icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png"
          },
          {
            src: "statics/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    },

    cordova: {
      // id: 'org.cordova.quasar.app'
      // noIosLegacyBuildFlag: true // uncomment only if you know what you are doing
    },

    electron: {
      // bundler: 'builder', // or 'packager'

      extendWebpack(cfg) {
        // do something with Electron main process Webpack cfg
        // chainWebpack also available besides this extendWebpack
      },

      packager: {
        // https://github.com/electron-userland/electron-packager/blob/master/docs/api.md#options
        // OS X / Mac App Store
        // appBundleId: '',
        // appCategoryType: '',
        // osxSign: '',
        // protocol: 'myapp://path',
        // Window only
        // win32metadata: { ... }
      },

      builder: {
        // https://www.electron.build/configuration/configuration
        // appId: 'quasar-app'
      }
    }
  };
};
