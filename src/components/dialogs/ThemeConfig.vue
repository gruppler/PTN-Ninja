<template>
  <small-dialog
    :value="value"
    @input="$emit('input', $event)"
    @before-hide="restore"
    content-class="theme-config non-selectable"
    no-backdrop-dismiss
    v-on="$listeners"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="color">{{ $t("Theme") }}</dialog-header>
    </template>

    <q-list>
      <ThemeSelector
        :value="initialThemeID"
        @input="selectTheme"
        :game="game"
        filled
        square
      />

      <q-separator />

      <q-input
        :label="$t('Name')"
        :error="!isValid"
        v-model="theme.name"
        :maxlength="maxNameLength"
        hide-bottom-space
        item-aligned
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="file" />
        </template>
      </q-input>

      <q-select
        :label="$t('Board Style')"
        v-model="theme.boardStyle"
        @input="preview"
        :options="boardStyles"
        behavior="menu"
        :option-label="getText"
        item-aligned
        filled
      >
        <template v-slot:prepend>
          <q-icon name="board" />
        </template>
      </q-select>

      <q-item tag="label" v-ripple>
        <q-item-section>
          <q-item-label>{{ $t("Checker") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="theme.boardChecker" @input="preview" />
        </q-item-section>
      </q-item>

      <q-item>
        <q-item-section>
          {{ $t("Stone Border Width") }}
          <q-slider
            v-model="theme.vars['piece-border-width']"
            @input="preview"
            :min="0"
            :max="4"
            :step="1"
            snap
            label
          />
        </q-item-section>
      </q-item>

      <q-expansion-item group="theme" icon="color" :label="$t('Colors')">
        <q-list>
          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("Advanced") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="advanced" />
            </q-item-section>
          </q-item>

          <smooth-reflow>
            <q-input
              ref="colorInputs"
              v-for="(color, key) in colors"
              :key="key"
              :label="$t('theme.' + key)"
              :value="theme.colors[key]"
              :rules="['anyColor']"
              @input="setColor(key, $event)"
              hide-bottom-space
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="color" />
              </template>

              <template v-slot:append>
                <q-btn :style="{ background: color }" round>
                  <q-popup-proxy
                    transition-show="scale"
                    transition-hide="scale"
                  >
                    <div>
                      <q-color
                        :value="color"
                        @change="setColor(key, $event)"
                        :palette="palette"
                      />
                    </div>
                  </q-popup-proxy>
                </q-btn>
              </template>
            </q-input>
          </smooth-reflow>
        </q-list>
      </q-expansion-item>

      <q-separator />

      <q-expansion-item
        group="theme"
        v-model="showImport"
        icon="json"
        :label="$t('Import')"
      >
        <q-input
          type="textarea"
          style="font-family: 'Source Code Pro'"
          :placeholder="$t('hint.pasteThemeCode')"
          v-model="json"
          filled
          square
        />
        <message-output :error="error" content-class="q-ma-md" />
      </q-expansion-item>
    </q-list>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn @click="reset" :label="$t('Reset')" :disable="isSaved" flat />
        <q-btn @click="share" :label="$t(canShare ? 'Share' : 'Copy')" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          @click="save"
          :label="$t('Save')"
          color="primary"
          :text-color="
            isSaved ? 'primary' : theme.primaryDark ? 'fg-light' : 'fg-dark'
          "
          :disable="!isValid || isSaved"
          :flat="isSaved"
          v-close-popup
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import ThemeSelector from "../controls/ThemeSelector";

import {
  cloneDeep,
  debounce,
  defaultsDeep,
  isEqual,
  kebabCase,
  pick,
} from "lodash";
import { BOARD_STYLES, PRIMARY_COLOR_IDS, computeFrom } from "../../themes";

const MAX_NAME_LENGTH = 16;

export default {
  name: "ThemeConfig",
  components: { ThemeSelector },
  props: ["value", "game"],
  data() {
    const theme = cloneDeep(this.$store.state.theme);
    return {
      maxNameLength: MAX_NAME_LENGTH,
      boardStyles: BOARD_STYLES,
      theme,
      initialThemeID: theme.id,
      initialTheme: cloneDeep(theme),
      palette: [],
      advanced: false,
      showImport: false,
      json: "",
      error: "",
    };
  },
  computed: {
    themes() {
      return this.$store.getters.themes;
    },
    id() {
      return this.theme.isBuiltIn && this.isSaved
        ? this.theme.id
        : this.getID(this.theme.name || "");
    },
    colors() {
      return this.advanced
        ? this.theme.colors
        : pick(this.theme.colors, PRIMARY_COLOR_IDS);
    },
    isValid() {
      return (
        this.isValidName(this.theme.name) && this.isUniqueID(this.theme.name)
      );
    },
    isSaved() {
      return isEqual(this.theme, this.initialTheme);
    },
    canShare() {
      return navigator.canShare;
    },
  },
  methods: {
    getText(key) {
      return this.$t("theme." + key);
    },
    init() {
      this.theme = cloneDeep(this.$store.state.theme);
      this.initialTheme = cloneDeep(this.theme);
      this.initialThemeID = this.initialTheme.id;
      this.updatePalette();
    },
    selectTheme(themeID) {
      const success = () => {
        this.theme = cloneDeep(this.$store.getters.theme(themeID));
        this.initialTheme = cloneDeep(this.theme);
        this.initialThemeID = this.initialTheme.id;
        this.updatePalette();
        this.$store.dispatch("SET_UI", ["themeID", this.initialThemeID]);
      };
      if (!this.isSaved) {
        this.$store.dispatch("PROMPT", {
          title: this.$t("Confirm"),
          message: this.$t("confirm.abandonChanges"),
          success,
          failure: () => {
            this.initialThemeID = this.initialTheme.id;
          },
        });
      } else {
        success();
      }
    },
    getID(name) {
      return kebabCase((name || "").trim());
    },
    isValidName(name) {
      name = (name || "").trim();
      return name.length > 0 && name.length <= MAX_NAME_LENGTH;
    },
    isUniqueID(name) {
      const id = this.getID(name);
      return (
        (id === this.theme.id && (this.isSaved || !this.theme.isBuiltIn)) ||
        !this.themes.find((theme) => theme.id === id)
      );
    },
    setColor(key, value) {
      this.theme.colors[key] = value;
      computeFrom(this.theme, key, this.advanced);
      this.updatePalette();
      this.preview();
    },
    updatePalette() {
      this.palette = Object.values(this.theme.colors);
    },
    reset() {
      this.$store.dispatch("PROMPT", {
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetTheme"),
        success: () => {
          this.theme = cloneDeep(this.initialTheme);
        },
      });
    },
    share() {
      this.$store.dispatch("COPY", {
        title: this.$t("Theme") + " – " + this.theme.name,
        text: JSON.stringify({ ...this.theme, id: this.id }),
      });
    },
    save() {
      if (!this.isValid) {
        return false;
      }
      delete this.theme.isBuiltIn;
      this.theme.id = this.id;
      const themes = cloneDeep(this.$store.state.themes);
      const index = themes.findIndex((theme) => theme.id === this.id);
      if (index >= 0) {
        themes.splice(index, 1);
      }
      themes.unshift(this.theme);
      this.initialTheme = cloneDeep(this.theme);
      this.initialThemeID = this.id;
      this.$store.dispatch("SET_UI", ["themes", themes]);
      this.$store.dispatch("SET_UI", ["themeID", this.id]);
    },
    preview() {
      this.$store.commit("SET_THEME", this.theme);
    },
    restore() {
      this.$store.commit("SET_THEME", this.initialTheme);
    },
  },
  created() {
    this.init();
    this.preview = debounce(this.preview, 50);
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.init();
      }
    },
    json(json) {
      this.error = "";
      if (!json) {
        return;
      }
      try {
        const theme = JSON.parse(json);
        this.theme = theme;
        this.preview();
        this.json = "";
        this.showImport = false;
      } catch (error) {
        this.error = error;
      }
    },
  },
};
</script>

<style lang="scss">
.theme-config {
  .q-dialog__backdrop {
    background: transparent;
  }
}
</style>
