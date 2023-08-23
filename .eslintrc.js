module.exports = {
  root: true,

  parserOptions: {
    parser: "babel-eslint",
    sourceType: "module",
  },

  env: {
    browser: true,
  },

  // https://github.com/vuejs/eslint-plugin-vue#priority-a-essential-error-prevention
  // consider switching to `plugin:vue/strongly-recommended` or `plugin:vue/recommended` for stricter rules.
  extends: ["plugin:vue/essential", "@vue/prettier"],

  // required to lint *.vue files
  plugins: ["vue"],

  globals: {
    ga: true, // Google Analytics
    cordova: true,
    __statics: true,
    process: true,
  },

  // add your custom rules here
  rules: {
    "prettier/prettier": ["error", { endOfLine: "auto" }], // disable `delete cr` warnings on windows

    "prefer-promise-reject-errors": "off",

    // allow console.log during development only
    "no-console": process.env.NODE_ENV === "production" ? "off" : "off",
    // allow debugger during development only
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    "vue/multi-word-component-names": 0,
  },
};
