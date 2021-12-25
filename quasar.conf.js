// Configuration for your app

module.exports = function(ctx) {
  return {
    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    boot: [
      "i18n",
      "shortkey",
      "globalComponents"
    ],

    css: ["app.scss"],

    extras: ["roboto-font", "mdi-v5"],

    framework: {
      importStrategy: "auto",
      autoImportComponentCase: "kebab",
      iconSet: "mdi-v5",

      plugins: [
        "AddressbarColor",
        "AppFullscreen",
        "BottomSheet",
        "Dialog",
        "Loading",
        "LocalStorage",
        "Notify"
      ]
    },

    build: {
      env: require("dotenv").config().parsed,
      scopeHoisting: true,
      vueRouterMode: "history",
      // vueCompiler: true,
      // gzip: true,
      // analyze: true,
      // extractCSS: false,
      extendWebpack(cfg) {
        cfg.module.rules.push({
          enforce: "pre",
          test: /\.(js|vue)$/,
          loader: "eslint-loader",
          exclude: /node_modules/,
          options: {
            formatter: require("eslint").CLIEngine.getFormatter("stylish")
          }
        });
      }
    },

    devServer: {
      // https: true,
      // port: 8080,
      open: true // opens browser window automatically
    },

    // animations: 'all', // --- includes all animations
    animations: [],

    ssr: {
      pwa: false
    },

    pwa: {
      workboxPluginMode: "GenerateSW",
      workboxOptions: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      },
      manifest: {
        name: "PTN Ninja",
        short_name: "PTN-Ninja",
        description: "An editor and viewer for Portable Tak Notation",
        display: "standalone",
        orientation: "any",
        background_color: "#607d8b",
        theme_color: "#37474f",
        icons: [
          {
            src: "icons/icon-128x128.png",
            sizes: "128x128",
            type: "image/png"
          },
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icons/icon-256x256.png",
            sizes: "256x256",
            type: "image/png"
          },
          {
            src: "icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png"
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    }
  };
};
