import Vue from "vue";
import VueI18n from "vue-i18n";
import messages from "src/i18n";

Vue.use(VueI18n);

const i18n = new VueI18n({
  locale: navigator.language.toLowerCase(),
  fallbackLocale: "en-us",
  messages
});

export default ({ app }) => {
  // Set i18n instance on app
  app.i18n = i18n;

  Vue.moment.updateLocale("en", messages["en-us"].date);
  Vue.moment.locale(app.i18n.locale);
};

export { i18n };
