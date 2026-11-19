<template>
  <large-dialog
    ref="dialog"
    :value="true"
    no-backdrop-dismiss
    :min-height="588"
    :width="wideLayout ? 1100 : undefined"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="embed">{{ $t("Embed") }}</dialog-header>
    </template>

    <div :class="{ 'config-layout': wideLayout }">
      <div
        :class="{
          'config-preview': wideLayout,
          'config-preview-sticky': stickyPreview,
        }"
      >
        <div class="relative-position">
          <iframe
            ref="preview"
            class="block"
            v-show="!previewError"
            @load="previewLoaded = true"
            @error="previewError = true"
            :src="initialURL"
            width="100%"
            :height="previewHeight"
            frameborder="0"
            allowfullscreen
          />
          <q-inner-loading :showing="!previewLoaded && !previewError" />
        </div>
      </div>

      <q-separator v-if="!wideLayout" />

      <q-list :class="{ 'config-options': wideLayout }">
        <q-item>
          <q-item-section>
            <q-input v-model="name" name="name" :label="$t('Name')" filled>
              <template v-slot:append>
                <q-icon
                  @click="name = name === gameName ? generatedName : gameName"
                  name="refresh"
                  class="q-field__focusable-action"
                />
              </template>
            </q-input>
          </q-item-section>
        </q-item>

        <q-item>
          <q-item-section>
            <q-input
              v-model="config.width"
              :label="$t('Width')"
              hide-bottom-space
              filled
            />
          </q-item-section>

          <q-item-section>
            <q-input
              v-model="config.height"
              :label="$t('Height')"
              hide-bottom-space
              filled
            />
          </q-item-section>
        </q-item>

        <ThemeSelector
          v-model="config.ui.themeID"
          :config="$store.state.ui.embedConfig.ui"
          item-aligned
          edit-button
          filled
        />
        <ImportButton
          :label="$t('Import Theme')"
          :placeholder="$t('hint.pasteThemeCode')"
          :handler="importTheme"
          :copy-text="customThemeCode"
          :copy-label="$t('Copy Theme')"
        />

        <setting-row v-for="entry in entries" :key="entry.id" :entry="entry" />

        <settings-sections />
      </q-list>
    </div>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Reset')" @click="reset" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Close')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t(canShare ? 'Share' : 'Copy')"
          color="primary"
          @click="share"
          v-close-popup
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import ImportButton from "../components/controls/ImportButton";
import SettingsSections from "../components/settings/SettingsSections";
import ThemeSelector from "../components/controls/ThemeSelector";
import { configScope } from "../settings/scope";
import {
  EMBED_ENTRIES,
  EMBED_IDS,
  EMBED_OVERRIDES,
  playerNames,
} from "../settings/exportScopes";
import { cloneDeep } from "lodash";
import { themeForExport } from "../themes";
import { generateName } from "../Game/base";

export default {
  name: "EmbedConfig",
  components: { ImportButton, SettingsSections, ThemeSelector },
  // The rows edit this dialog's config, not the live settings
  provide() {
    return {
      settingsScope: configScope({
        state: () => ({ ui: this.config.ui, export: this.config }),
        ids: EMBED_IDS,
        overrides: EMBED_OVERRIDES,
        local: [playerNames, ...EMBED_ENTRIES],
      }),
    };
  },
  data() {
    return {
      name: "",
      url: "",
      config: cloneDeep(this.$store.state.ui.embedConfig),
      previewError: false,
      previewLoaded: false,
      initialURL: "",
    };
  },
  computed: {
    entries() {
      return EMBED_ENTRIES;
    },
    // The embed's theme code, if it's a custom one
    customThemeCode() {
      const theme = this.$store.getters["ui/theme"](this.config.ui.themeID);
      return theme && !theme.isBuiltIn
        ? JSON.stringify(themeForExport(theme))
        : "";
    },
    dialogContentHeight() {
      if (this.$q.screen.lt.sm) {
        return this.$q.screen.height - 116;
      }
      return 588 - 116;
    },
    previewHeight() {
      if (this.previewError) return "0";
      if (this.wideLayout) {
        return this.dialogContentHeight + "px";
      }
      return "333px";
    },
    wideLayout() {
      return this.$q.screen.width >= 800;
    },
    stickyPreview() {
      if (this.wideLayout) return true;
      const height = parseInt(this.previewHeight) || 333;
      return this.$q.screen.height >= 2 * height;
    },
    gameName() {
      return this.$store.state.game.name;
    },
    generatedName() {
      let tags = { ...this.$store.state.game.ptn.tags };
      if (!this.config.includeNames) {
        tags.player1 = "";
        tags.player2 = "";
      }
      return generateName(tags);
    },
    code() {
      return `<iframe src="${this.url}" width="${this.config.width}" height="${this.config.height}" style="width:${this.config.width}; max-width:calc(100vw - 30px); height:${this.config.height}; max-height:100vh;" frameborder="0" allowfullscreen></iframe>`;
    },
    canShare() {
      return this.$store.state.nativeSharing;
    },
  },
  methods: {
    postMessage(action, value) {
      if (this.$refs.preview) {
        this.$refs.preview.contentWindow.postMessage({ action, value });
      }
    },
    updateURL() {
      this.url = this.$store.getters["ui/url"](this.$game, {
        origin: true,
        name: this.name,
        names: this.config.includeNames,
        state: this.config.state,
        ui: this.config.ui,
      });
    },
    reset() {
      this.prompt({
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetEmbed"),
        success: () => {
          const config = cloneDeep(this.$store.state.ui.defaults.embedConfig);
          config.ui.themeID = this.$store.state.ui.themeID;
          config.ui.theme = this.$store.state.ui.theme;
          this.config = config;
        },
      });
    },
    // Saves theme code and embeds with it, without opening the theme editor
    async importTheme(json) {
      const theme = await this.$store.dispatch("ui/IMPORT_THEME", json);
      this.config.ui.themeID = theme.id;
    },
    share() {
      this.$store.dispatch("ui/SHARE", {
        title: this.$t("Embed") + " – " + this.name,
        text: this.code,
      });
    },
    close() {
      this.$refs.dialog.hide();
    },
  },
  watch: {
    name(value) {
      this.postMessage("SET_NAME", value);
      this.updateURL();
    },
    "config.ui.themeID"(themeID) {
      this.config.ui.theme = this.$store.getters["ui/theme"](themeID);
    },
    "config.includeNames"(value) {
      this.postMessage("SHOW_NAMES", value);
    },
    "config.state"(value) {
      if (value) {
        this.postMessage("GO_TO_PLY", {
          plyID: this.$game.board.plyID,
          isDone: this.$game.board.plyIsDone,
        });
      } else {
        this.postMessage("FIRST");
      }
    },
    "config.ui": {
      handler(value) {
        this.postMessage("SET_UI", value);
      },
      deep: true,
    },
    config: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["embedConfig", cloneDeep(value)]);
        this.updateURL();
      },
      deep: true,
    },
  },
  mounted() {
    this.name = this.gameName;
    this.initialURL = this.$store.getters["ui/url"](this.$game, {
      origin: true,
      name: this.name,
      names: true,
      state: this.config.state,
      ui: this.config.ui,
    });
    this.updateURL();
    if (!this.config.includeNames) {
      const hideNames = () => {
        this.postMessage("SHOW_NAMES", false);
        this.$refs.preview.contentWindow.removeEventListener("load", hideNames);
      };
      this.$nextTick(() => {
        this.$refs.preview.contentWindow.addEventListener("load", hideNames);
      });
    }
  },
};
</script>
