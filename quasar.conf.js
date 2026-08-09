// Configuration for your app

const fs = require("fs");
const path = require("path");

module.exports = function (ctx) {
  // Expose the app version (from package.json) so the client can drive the
  // in-app changelog / "What's New" dialog and version tracking.
  const appVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"),
  ).version;

  return {
    // app boot file (/src/boot)
    // --> boot files are part of "main.js"
    boot: ["i18n", "shortkey", "globalComponents", "utilities", "longPress"],

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
        "Notify",
      ],
    },

    build: {
      env: {
        ...require("dotenv").config().parsed,
        PLAYTAK_BETA: ctx.dev || ctx.debug,
        PLAYTAK_USE_PROXY: ctx.dev,
        APP_VERSION: appVersion,
      },
      scopeHoisting: true,
      vueRouterMode: "history",
      // vueCompiler: true,
      // gzip: true,
      // analyze: true,
      // extractCSS: false,
      extendWebpack(cfg) {
        cfg.resolve = cfg.resolve || {};
        cfg.resolve.alias = {
          ...(cfg.resolve.alias || {}),
          stream: require.resolve("stream-browserify"),
          buffer: require.resolve("buffer/"),
          process: require.resolve("process/browser"),
        };

        cfg.module.rules.push(
          {
            enforce: "pre",
            test: /\.(js|vue)$/,
            loader: "eslint-loader",
            exclude: /node_modules/,
            options: {
              formatter: require("eslint").CLIEngine.getFormatter("stylish"),
            },
          },
          {
            test: /\.js$/,
            loader: require.resolve("@open-wc/webpack-import-meta-loader"),
          },
        );
      },
    },

    devServer: {
      // https: true,
      port: 8081,
      proxy: {
        "/playtak-api": {
          target: "https://api.beta.playtak.com",
          changeOrigin: true,
          pathRewrite: {
            "^/playtak-api": "",
          },
        },
      },
      open: false,
    },

    // animations: 'all', // --- includes all animations
    animations: [],

    ssr: {
      pwa: false,
    },

    pwa: {
      workboxPluginMode: "GenerateSW",
      workboxOptions: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // Serve the precached document for navigation requests that don't
        // match a precached asset, so the client-side router (history mode)
        // can handle deep links offline. Must match the precache manifest
        // key exactly — createHandlerBoundToURL throws if it isn't precached.
        navigateFallback: "/index.html",
      },
      manifest: {
        name: "PTN Ninja",
        short_name: "PTN-Ninja",
        description: "An editor and viewer for Portable Tak Notation",
        display: "standalone",
        // orientation: "any",
        background_color: "#607d8b",
        theme_color: "#37474f",
        icons: [
          {
            src: "icons/icon-128x128.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-256x256.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "icons/icon-384x384.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    },
  };
};
