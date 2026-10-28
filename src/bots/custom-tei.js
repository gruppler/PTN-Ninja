import store from "../store";
import TeiBot from "./tei";
import { i18n } from "../boot/i18n";
import { forEach, omit, isEmpty } from "lodash";

const FIXED_META_KEYS = ["name", "author", "limitTypes", "sizeHalfKomis"];

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
      icon: "tei",
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

  // The user may edit a saved engine's name, version and author, and those
  // edits stand for as long as the engine keeps reporting what it did before.
  // When it reports something different - an upgrade, say - the engine wins.
  // `meta.reported` is what it said last.
  reportIdentity(identity) {
    const reported = { ...this.meta.reported };
    const changes = {};
    let isChanged = false;
    forEach(identity, (value, key) => {
      if (reported[key] === value) return;
      // First report: nothing to compare with, so only fill in what's blank
      if (key in reported || !this.meta[key]) {
        changes[key] = value;
      }
      reported[key] = value;
      isChanged = true;
    });
    if (!isChanged) return;

    this.setMeta({ ...changes, reported }, true);
    store.dispatch("analysis/UPDATE_CUSTOM_BOT_META", {
      botID: this.id,
      changes: { ...changes, reported },
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
    const settingsOptions = this.settings.options || {};
    forEach(this.meta.presetOptions, (option, key) => {
      const exactMatch = Object.prototype.hasOwnProperty.call(
        settingsOptions,
        key
      )
        ? key
        : null;
      const caseInsensitiveMatch = exactMatch
        ? null
        : Object.keys(settingsOptions).find(
            (settingsKey) => settingsKey.toLowerCase() === key.toLowerCase()
          );
      const matchingKey = exactMatch || caseInsensitiveMatch;

      if (matchingKey) {
        options[key] = settingsOptions[matchingKey];
      } else if (
        option &&
        Object.prototype.hasOwnProperty.call(option, "value")
      ) {
        options[key] = option.value;
      } else if (
        option &&
        Object.prototype.hasOwnProperty.call(option, "default")
      ) {
        options[key] = option.default;
      }
    });
    return options;
  }
}
