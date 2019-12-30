import { Dialog, Notify } from "quasar";

import { compressToEncodedURIComponent } from "lz-string";

export const confirm = () => ({ title, message, ok, cancel, success }) => {
  Dialog.create({
    title,
    message,
    "no-backdrop-dismiss": true,
    ok: {
      label: ok,
      flat: true,
      color: "accent"
    },
    cancel: {
      label: cancel,
      flat: true,
      color: "accent"
    },
    class: "bg-secondary"
  }).onOk(success);
};

export const error = () => ({ message, timeout }) => {
  Notify.create({
    message,
    timeout: timeout || 0,
    icon: "error",
    color: "negative",
    position: "top-right",
    actions: [{ icon: "close", color: "grey-10" }],
    classes: "text-grey-10"
  });
};

export const uniqueName = state => (name, ignoreFirst = false) => {
  const names = state.games.slice(1 * ignoreFirst).map(game => game.name);
  while (names.includes(name)) {
    if (/\(\d+\)$/.test(name)) {
      name = name.replace(/\((\d+)\)$/, (match, number) => {
        number = parseInt(number, 10) + 1;
        return `(${number})`;
      });
    } else {
      name += " (1)";
    }
  }
  return name;
};

export const url = state => (game, options = {}) => {
  if (!game) {
    return "";
  }

  let url = compressToEncodedURIComponent(game.ptn);
  let params = {};

  if ("name" in options) {
    params.name = options.name;
  } else if (game.name && game.name !== game.generateName()) {
    params.name = game.name;
  }

  if (options.origin) {
    url = location.origin + "/?#/" + url;
  }

  if (options.state) {
    if (options.state === true) {
      options.state = game.state;
    }
    if (options.state.targetBranch) {
      params.targetBranch = options.state.targetBranch;
    }
    params.ply = options.state.plyIndex;
    if (options.state.plyIsDone) {
      params.ply += "!";
    }
  }

  if (options.ui) {
    Object.keys(options.ui).forEach(key => {
      const value = options.ui[key];
      if (key in state.defaults && value !== state.defaults[key]) {
        params[key] = value;
      }
    });
  }

  if (Object.keys(params).length) {
    url +=
      "&" +
      Object.keys(params)
        .map(key => key + "=" + encodeURIComponent(params[key]))
        .join("&");
  }
  return url;
};
