import ShortKey from "vue-shortkey";

export default ({ Vue }) => {
  Vue.use(ShortKey, { prevent: ["input", "textarea"] });
};
