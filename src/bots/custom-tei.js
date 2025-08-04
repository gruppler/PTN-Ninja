import TeiBot from "./tei";
import { i18n } from "../boot/i18n";
import { forEach, omit, isEmpty } from "lodash";

const FIXED_META_KEYS = [
  "name",
  "author",
  "isInteractive",
  "limitTypes",
  "sizeHalfKomis",
];

export default class CustomTeiBot extends TeiBot {
  constructor(id, meta) {
    const settings = {
      limitTypes: [Object.keys(meta.limitTypes)[0]],
    };
    if (meta.limitTypes.depth) {
      settings.depth = Math.min(meta.limitTypes.depth.max, 10);
    }
    if (meta.limitTypes.nodes) {
      settings.nodes = Math.min(meta.limitTypes.nodes.max, 1e3);
    }
    if (meta.limitTypes.movetime) {
      settings.movetime = Math.min(meta.limitTypes.movetime.max, 5e3);
    }

    super({
      id,
      icon: "bot",
      label: `${meta.name}${meta.version ? " " + meta.version : ""}`,
      description: meta.author ? `${i18n.t("tei.by")} ${meta.author}` : "",
      settings,
      meta: {
        ...meta,
        isCustom: true,
        teiVersion: 0,
      },
    });

    Object.defineProperty(this, "label", {
      get: () =>
        this.meta.name + (this.meta.version ? " " + this.meta.version : ""),
    });
    Object.defineProperty(this, "description", {
      get: () =>
        this.meta.author ? `${i18n.t("tei.by")} ${this.meta.author}` : "",
    });
  }

  setMeta(meta, override = false) {
    if (!override) {
      meta = omit(meta, FIXED_META_KEYS);
    }
    if (meta.options) {
      meta.options = omit(
        meta.options,
        Object.keys(meta.presetOptions || this.meta.presetOptions)
      );
    }
    if (!isEmpty(meta)) {
      super.setMeta(meta);
    }
  }

  get protocol() {
    return this.meta.connection.ssl ? "wss://" : "ws://";
  }

  get url() {
    let url = `${this.protocol}${this.meta.connection.address}`;
    if (this.meta.connection.port) {
      url += `:${this.meta.connection.port}`;
    }
    return url;
  }

  getOptions() {
    const options = { ...super.getOptions() };
    forEach(
      this.meta.presetOptions,
      ({ value }, key) => (options[key] = value)
    );
    return options;
  }
}
