<template>
  <small-dialog
    :value="true"
    @before-hide="restore"
    :content-class="{
      seethrough,
      disablePointerEvents,
      'theme-config non-selectable': true,
    }"
    no-backdrop-dismiss
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="color" :title="$t('Theme')">
        <template v-slot:buttons>
          <q-btn
            icon="visibility_off"
            @mousedown="hide"
            @mouseup="unhide"
            @touchstart="hide"
            @touchend="unhide"
            @click.right.prevent.stop
            v-touch-pan.mouse.preserveCursor.prevent="unhide"
            v-ripple="false"
            dense
            flat
          />
        </template>
      </dialog-header>
    </template>

    <q-list style="width: 320px">
      <ThemeSelector
        :value="initialThemeID"
        @input="selectTheme"
        filled
        square
      />

      <q-separator />

      <q-input
        :label="$t('Name')"
        :error="!isValid"
        v-model.trim="theme.name"
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

      <!-- Style -->
      <q-expansion-item
        group="theme"
        icon="board_style"
        :label="$t('Style')"
        expand-separator
      >
        <q-list>
          <q-select
            :label="$t('Board Style')"
            v-model="theme.boardStyle"
            @input="preview"
            :options="boardStyles"
            behavior="menu"
            :option-label="getText"
            transition-show="none"
            transition-hide="none"
            item-aligned
            filled
          />

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
                @pan="hideWhilePanning"
                :min="0"
                :max="4"
                :step="1"
                markers
                snap
                label
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>

      <q-expansion-item
        group="theme"
        icon="color"
        :label="$t('Colors')"
        expand-separator
      >
        <q-list>
          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("Manual Mode") }}</q-item-label>
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
                <ColorPicker
                  :label="$t('theme.' + key)"
                  :value="color"
                  :palette="palette"
                  @input="setColor(key, $event)"
                  @before-show="hide(true)"
                  @before-hide="unhide"
                  round
                />
              </template>
            </q-input>
          </smooth-reflow>
        </q-list>
      </q-expansion-item>

      <q-expansion-item group="theme" expand-separator>
        <template v-slot:header>
          <q-item-section avatar>
            <q-icon name="ring1" />
            <q-icon name="ring2" class="absolute" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $t("Rings") }}</q-item-label>
          </q-item-section>
        </template>
        <q-list>
          <q-item tag="label" v-ripple>
            <q-item-section>
              <q-item-label>{{ $t("From Center") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="theme.fromCenter" @input="preview" />
            </q-item-section>
          </q-item>
          <q-item>
            <q-item-section>
              {{ $t("Rings") }}
              <q-slider
                :value="theme.rings"
                @input="
                  theme.rings = $event;
                  preview();
                "
                @pan="hideWhilePanning"
                :min="0"
                :max="4"
                :step="1"
                markers
                snap
                label
              />
            </q-item-section>
          </q-item>
          <q-item v-show="theme.rings > 0">
            <q-item-section>
              {{ $t("Opacity") }}
              <q-slider
                v-model="theme.vars['rings-opacity']"
                @input="preview()"
                @pan="hideWhilePanning"
                :min="0"
                :max="1"
                :step="0.01"
                :label-value="
                  Math.round(100 * theme.vars['rings-opacity']) + '%'
                "
                snap
                label
              />
            </q-item-section>
          </q-item>
          <div class="row">
            <div class="col">
              <q-input
                v-for="n in 4"
                :key="n"
                v-show="theme.rings >= n"
                :class="{ 'q-pr-none': theme.rings > 1 }"
                :label="$t('theme.ring' + n)"
                :value="theme.colors[`ring${n}`]"
                :rules="['anyColor']"
                @input="setColor(`ring${n}`, $event)"
                hide-bottom-space
                item-aligned
                filled
              >
                <template v-slot:prepend>
                  <q-icon name="color" />
                </template>

                <template v-slot:append>
                  <ColorPicker
                    :label="$t('theme.ring' + n)"
                    :value="theme.colors[`ring${n}`]"
                    :palette="palette"
                    @input="setColor(`ring${n}`, $event)"
                    @before-show="hide(true)"
                    @before-hide="unhide"
                    round
                  />
                </template>
              </q-input>
            </div>
            <q-btn
              v-show="theme.rings > 1"
              @click="invertRings"
              icon="swap_vert"
              stretch
              dense
              flat
            />
          </div>
        </q-list>
      </q-expansion-item>

      <q-separator />

      <q-expansion-item
        @click="clipboard"
        v-model="showImport"
        icon="clipboard"
        :label="$t('Import')"
        expand-icon="none"
        expanded-icon="up"
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
            isSaved ? 'primary' : theme.primaryDark ? 'textLight' : 'textDark'
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
import ThemeSelector from "../components/controls/ThemeSelector";
import ColorPicker from "../components/controls/ColorPicker";

import {
  cloneDeep,
  debounce,
  isEqual,
  kebabCase,
  omit,
  pick,
  throttle,
} from "lodash";
import {
  BOARD_STYLES,
  PRIMARY_COLOR_IDS,
  HIDDEN_COLOR_IDS,
  computeFrom,
} from "../themes";

const MAX_NAME_LENGTH = 16;

export default {
  name: "ThemeConfig",
  components: { ThemeSelector, ColorPicker },
  data() {
    const theme = cloneDeep(this.$store.state.ui.theme);
    return {
      maxNameLength: MAX_NAME_LENGTH,
      boardStyles: BOARD_STYLES,
      theme,
      initialThemeID: theme.id,
      initialTheme: cloneDeep(theme),
      palette: [],
      seethrough: false,
      disablePointerEvents: false,
      advanced: false,
      showImport: false,
      json: "",
      error: "",
    };
  },
  computed: {
    themes() {
      return this.$store.getters["ui/themes"];
    },
    id() {
      return this.theme.isBuiltIn && this.isSaved
        ? this.theme.id
        : this.getID(this.theme.name || "");
    },
    colors() {
      return omit(
        this.advanced
          ? this.theme.colors
          : pick(this.theme.colors, PRIMARY_COLOR_IDS),
        HIDDEN_COLOR_IDS.concat(["ring1", "ring2", "ring3", "ring4"])
      );
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
      return this.$store.state.nativeSharing;
    },
  },
  methods: {
    hide(disablePointerEvents) {
      this.seethrough = true;
      if (disablePointerEvents === true) {
        this.disablePointerEvents = disablePointerEvents;
      }
    },
    unhide(event) {
      if (!event || event.isFinal || !("isFinal" in event)) {
        this.seethrough = false;
        this.disablePointerEvents = false;
      }
    },
    hideWhilePanning(phase) {
      switch (phase) {
        case "start":
          this.hide();
          break;
        case "end":
          this.unhide();
          break;
      }
    },
    getText(key) {
      return this.$t("theme." + key);
    },
    init() {
      this.theme = cloneDeep(this.$store.state.ui.theme);
      this.initialTheme = cloneDeep(this.theme);
      this.initialThemeID = this.initialTheme.id;
      this.updatePalette();
    },
    selectTheme(themeID) {
      const success = () => {
        this.theme = cloneDeep(this.$store.getters["ui/theme"](themeID));
        this.initialTheme = cloneDeep(this.theme);
        this.initialThemeID = this.initialTheme.id;
        this.updatePalette();
        this.$store.dispatch("ui/SET_UI", ["themeID", this.initialThemeID]);
      };
      if (!this.isSaved) {
        this.prompt({
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
      return kebabCase(name || "");
    },
    invertRings() {
      let colors = {};
      for (let i = 0; i < this.theme.rings; i++) {
        colors[`ring${i + 1}`] =
          this.theme.colors[`ring${this.theme.rings - i}`];
      }
      // Object.keys(colors).forEach((key) =>
      //   this.$set(this.theme.colors, key, colors[key])
      // );
      Object.assign(this.theme.colors, colors);
      this.preview();
    },
    isValidName(name) {
      name = name || "";
      return name.length > 0 && name.length <= MAX_NAME_LENGTH;
    },
    isUniqueID(name) {
      const id = this.getID(name);
      return (
        (id === this.theme.id && (this.isSaved || !this.theme.isBuiltIn)) ||
        !this.themes.find((theme) => theme.id === id)
      );
    },
    setColor: throttle(function (key, value) {
      this.theme.colors[key] = value;
      computeFrom(this.theme, key, false, this.advanced);
      this.updatePalette();
      this.preview();
    }, 100),
    updatePalette() {
      this.palette = Object.values(this.theme.colors);
    },
    async clipboard() {
      try {
        this.json = await this.$store.dispatch("ui/PASTE");
      } catch (error) {
        console.error(error);
      }
    },
    reset() {
      this.prompt({
        title: this.$t("Confirm"),
        message: this.$t("confirm.resetTheme"),
        success: () => {
          this.theme = cloneDeep(this.initialTheme);
          this.preview();
        },
      });
    },
    share() {
      const theme = { ...this.theme, id: this.id };
      if (!this.isSaved) {
        delete theme.isBuiltIn;
      }
      this.$store.dispatch("ui/SHARE", {
        title: this.$t("Theme") + " – " + this.theme.name,
        text: JSON.stringify(theme),
      });
    },
    save() {
      if (!this.isValid) {
        return false;
      }
      delete this.theme.isBuiltIn;
      this.theme.id = this.id;
      const themes = cloneDeep(this.$store.state.ui.themes);
      const index = themes.findIndex((theme) => theme.id === this.id);
      if (index >= 0) {
        themes.splice(index, 1);
      }
      themes.unshift(this.theme);
      this.initialTheme = cloneDeep(this.theme);
      this.initialThemeID = this.id;
      this.$store.dispatch("ui/SET_UI", ["themes", themes]);
      this.$store.dispatch("ui/SET_UI", ["themeID", this.id]);
    },
    preview: throttle(function () {
      this.$store.commit("ui/SET_THEME", this.theme);
    }, 10),
    restore() {
      this.$store.commit("ui/SET_THEME", this.initialTheme);
    },
  },
  created() {
    this.init();
    this.preview = debounce(this.preview, 50);
  },
  watch: {
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
  mounted() {
    this.init();
  },
};
</script>

<style lang="scss">
.q-dialog.theme-config {
  &.seethrough {
    .dialog-content,
    .q-dialog__backdrop {
      opacity: 0;
    }
  }
  &.seethrough.disablePointerEvents {
    .dialog-content {
      pointer-events: none;
    }
  }
}
</style>
