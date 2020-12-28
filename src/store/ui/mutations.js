import { Dark } from "quasar";
import { cloneDeep, forEach, isBoolean, isNumber } from "lodash";
import { computeMissing } from "../../themes";

export const SET_THEME = (state, theme) => {
  theme = cloneDeep(theme);
  computeMissing(theme);

  state.theme = cloneDeep(theme);
  Dark.set(theme.isDark);
  window.themeColor.content = theme.colors.accent;
  forEach(theme.colors, (color, key) => {
    document.body.style.setProperty("--q-color-" + key, color);
  });
  forEach(theme.vars, (value, key) => {
    if (isNumber(value)) {
      value += "px";
    }
    document.body.style.setProperty("--" + key, value);
  });
  forEach(theme, (value, key) => {
    if (isBoolean(value)) {
      document.body.classList[value ? "add" : "remove"](key);
    }
  });
};

export const SET_UI = (state, [key, value]) => {
  if (key in state.defaults) {
    state[key] = cloneDeep(value);
  }
};

export const SET_EMBED_GAME = (state) => {
  state.embed = true;
};
