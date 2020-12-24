<template>
  <small-dialog
    :value="value"
    @input="$emit('input', $event)"
    @before-hide="restore"
    content-class="theme-config non-selectable"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="edit">{{ $t("Theme") }}</dialog-header>
    </template>

    <q-list separator>
      <ThemeSelector v-model="initialThemeID" @input="selectTheme" />

      <q-input
        :label="$t('Name')"
        :rules="[isValidName, isUniqueID]"
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
        :options="boardStyles"
        behavior="menu"
        item-aligned
        map-options
        emit-value
        filled
      >
        <template v-slot:prepend>
          <q-icon name="board" />
        </template>
      </q-select>

      <q-expansion-item group="theme" icon="color" :label="$t('Colors')">
        <q-list>
          <q-input
            v-for="(color, name) in theme.colors"
            :key="name"
            :label="name"
            v-model="theme.colors[name]"
            :rules="['anyColor']"
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
                  breakpoint="200"
                  @hide="updatePalette"
                >
                  <div>
                    <q-color
                      :value="color"
                      @change="theme.colors[name] = $event"
                      :palette="palette"
                    />
                  </div>
                </q-popup-proxy>
              </q-btn>
            </template>
          </q-input>
        </q-list>
      </q-expansion-item>

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
        <q-btn @click="reset" :label="$t('Reset')" flat />
        <q-btn @click="share" :label="$t(canShare ? 'Share' : 'Copy')" flat />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          @click="save"
          :label="$t('Save')"
          color="primary"
          :disable="!isValid || isSaved"
          flat
          v-close-popup
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
import ThemeSelector from "../controls/ThemeSelector";

import { cloneDeep, defaultsDeep, isEqual, kebabCase } from "lodash";
import { BOARD_STYLES } from "../../themes";

const MAX_NAME_LENGTH = 16;

export default {
  name: "ThemeConfig",
  components: { ThemeSelector },
  props: ["value"],
  data() {
    const theme = cloneDeep(this.$store.getters.theme());
    return {
      maxNameLength: MAX_NAME_LENGTH,
      boardStyles: BOARD_STYLES,
      theme,
      initialThemeID: theme.id,
      initialTheme: cloneDeep(theme),
      palette: [],
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
      return this.getID(this.theme.name || "");
    },
    isValid() {
      return this.isValidName() && this.isUniqueID();
    },
    isSaved() {
      return isEqual(this.theme, this.initialTheme);
    },
    canShare() {
      return navigator.canShare;
    },
  },
  methods: {
    init() {
      this.theme = cloneDeep(this.$store.getters.theme());
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
        this.preview();
        this.$store.dispatch("SET_UI", ["theme", this.initialThemeID]);
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
      return kebabCase(name);
    },
    isValidName(name = this.theme.name) {
      name = name || "";
      return name.length > 0 && name.length <= MAX_NAME_LENGTH;
    },
    isUniqueID(name = this.theme.name) {
      const id = this.getID(name || "");
      return (
        id === this.theme.id || !this.themes.find((theme) => theme.id === id)
      );
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
      this.$store.dispatch("SET_UI", ["theme", this.id]);
    },
    preview() {
      this.$store.dispatch("SET_THEME", this.theme);
    },
    restore() {
      this.$store.dispatch("SET_THEME", this.initialTheme);
    },
  },
  created() {
    this.init();
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.init();
      }
    },
    "theme.colors": {
      handler(colors) {
        if (this.value) {
          this.preview();
        }
      },
      deep: true,
    },
    json(json) {
      this.error = "";
      if (!json) {
        return;
      }
      try {
        json = JSON.parse(json);
        const theme = {};
        defaultsDeep(theme, json, this.theme);
        delete theme.isBuiltIn;
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

<style lang="scss"></style>
