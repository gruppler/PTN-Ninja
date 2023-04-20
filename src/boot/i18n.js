import Vue from "vue";
import VueI18n from "vue-i18n";
import messages from "src/i18n";

Vue.use(VueI18n);

const numberFormats = {
  "en-us": {
    n0: {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    },
    n2: {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
};

const i18n = new VueI18n({
  locale: navigator.language.toLowerCase(),
  fallbackLocale: "en-us",
  messages,
  numberFormats,
});

export default ({ app }) => {
  // Set i18n instance on app
  app.i18n = i18n;
};

export { i18n };
