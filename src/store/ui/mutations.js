import { Dark } from "quasar";
import { cloneDeep, forEach, isBoolean } from "lodash";
import { computeMissing } from "../../themes";
import { deepFreeze, postMessage } from "../../utilities";

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
    postMessage("SET_UI", { [key]: value });
  }
};

export const SET_EMBED_GAME = (state) => {
  state.embed = true;
};

export const SET_SCRUBBING = (state, phase) => {
  state.scrubbing = phase === "start";
};

export const SET_THUMBNAIL = (state, { id, options, url }) => {
  state.thumbnails[id] = deepFreeze({ options: cloneDeep(options), url });
};

export const SET_SHORT_LINK = (state, { hash, url }) => {
  state.shortLinks[hash] = url;
};
