import ShortKey from "vue-shortkey";

export default ({ Vue }) => {
  Vue.use(ShortKey, {
    // Keys go to these while they have focus: a settings row of buttons
    // takes the arrow keys, Space and Enter
    prevent: [
      "input",
      "textarea",
      ".q-select *",
      ".setting-buttons *",
      ".q-dialog-plugin *",
    ],
  });
};
