<template>
  <div v-if="!state.hidden" class="setting-row">
    <!-- Toggle -->
    <q-item
      v-if="entry.control === 'toggle'"
      :data-setting="entry.id"
      :style="itemIndent"
      :disable="state.disabled"
      :dark="dark"
      v-ripple="!state.disabled"
      tag="label"
    >
      <q-item-section>
        <q-item-label>{{ $t(entry.label) }}</q-item-label>
        <smooth-reflow>
          <q-item-label v-if="hintText" caption>{{ hintText }}</q-item-label>
        </smooth-reflow>
      </q-item-section>
      <q-item-section v-if="hotkey" class="setting-hotkey" side>
        {{ hotkey }}
      </q-item-section>
      <q-item-section side>
        <q-toggle
          :value="Boolean(state.value)"
          @input="set"
          :disable="state.disabled"
          :dark="dark"
        />
      </q-item-section>
    </q-item>

    <!-- Select, with few enough options to show them all as buttons -->
    <q-item
      v-else-if="entry.control === 'select' && asButtons"
      class="setting-buttons-row"
      :data-setting="entry.id"
      :style="itemIndent"
      :disable="state.disabled"
      :dark="dark"
    >
      <q-item-section>
        <q-item-label>{{ $t(entry.label) }}</q-item-label>
        <smooth-reflow>
          <q-item-label v-if="hintText" caption>{{ hintText }}</q-item-label>
        </smooth-reflow>
      </q-item-section>
      <q-item-section v-if="hotkey" class="setting-hotkey" side>
        {{ hotkey }}
      </q-item-section>
      <div class="setting-buttons" @keydown="moveFocus" @click="blurOnPointer">
        <q-btn-toggle
          :value="state.value"
          @input="set"
          :options="buttonOptions"
          :disable="state.disabled"
          :class="{ 'setting-buttons--dark': isDark }"
          class="full-width"
          toggle-color="primary"
          unelevated
          no-caps
          no-wrap
        />
      </div>
    </q-item>

    <!-- Select -->
    <div
      v-else-if="entry.control === 'select'"
      :data-setting="entry.id"
      :style="indent"
    >
      <q-select
        :value="state.value"
        @input="set"
        :options="options"
        :label="$t(entry.label)"
        :hint="hintText"
        :disable="state.disabled"
        :dark="dark"
        behavior="menu"
        transition-show="none"
        transition-hide="none"
        item-aligned
        map-options
        emit-value
        filled
      />
    </div>

    <!-- Slider -->
    <q-item
      v-else-if="entry.control === 'slider'"
      :data-setting="entry.id"
      :style="itemIndent"
      :disable="state.disabled"
      :dark="dark"
    >
      <q-item-section>
        <q-item-label>{{ $t(entry.label) }}</q-item-label>
        <smooth-reflow>
          <q-item-label v-if="hintText" caption>{{ hintText }}</q-item-label>
        </smooth-reflow>
        <q-slider
          :value="state.value"
          @input="set"
          :min="entry.min"
          :max="entry.max"
          :step="entry.step"
          :disable="state.disabled"
          :dark="dark"
          :label-value="sliderLabel"
          snap
          label
        />
      </q-item-section>
    </q-item>

    <!-- Number -->
    <div
      v-else-if="entry.control === 'number'"
      :data-setting="entry.id"
      :style="indent"
    >
      <q-input
        :value="state.value"
        @input="setNumber"
        type="number"
        :label="$t(entry.label)"
        :hint="hintText"
        :min="entry.min"
        :max="entry.max"
        :disable="state.disabled"
        :dark="dark"
        item-aligned
        filled
      />
    </div>

    <!-- Theme -->
    <div
      v-else-if="entry.control === 'theme'"
      :data-setting="entry.id"
      :style="indent"
    >
      <ThemeSelector
        :value="state.value"
        @input="set"
        :disable="state.disabled"
        :dark="dark"
        edit-button
        filled
        :item-aligned="!flush"
        :square="flush"
      >
        <template v-slot:prepend>
          <q-icon name="color" />
        </template>
      </ThemeSelector>
      <ImportButton
        v-if="!$store.state.ui.embed"
        :label="$t('Import Theme')"
        :placeholder="$t('hint.pasteThemeCode')"
        :handler="importTheme"
        :dark="dark"
        :copy-text="customThemeCode"
        :copy-label="$t('Copy Theme')"
      />
    </div>

    <!-- Component -->
    <div
      v-else-if="entry.control === 'component'"
      :data-setting="entry.id"
      :style="indent"
    >
      <component :is="entry.component" v-bind="componentProps" />
    </div>

    <setting-row
      v-for="child in children"
      :key="child.id"
      :entry="child"
      :dark="dark"
      :depth="depth + 1"
      :omit="omit"
    />
  </div>
</template>

<script>
import OpeningsSettings from "../drawers/OpeningsSettings";
import SettingScrollThreshold from "./SettingScrollThreshold";
import SettingsAccount from "./SettingsAccount";
import SettingsBackup from "./SettingsBackup";
import SettingsEngines from "./SettingsEngines";
import ImportButton from "../controls/ImportButton";
import ThemeSelector from "../controls/ThemeSelector";

import { pick } from "lodash";
import { themeForExport } from "../../themes";
import { HOTKEYS_FORMATTED } from "../../keymap";
import { disabledHintOf, entryState } from "../../settings/registry";
import { storeScope } from "../../settings/scope";

// Children's extra left padding, per level
const INDENT = 24;
// A q-item's own left padding, which an indented q-item replaces
const ITEM_PADDING = 16;
// The most options a select shows as a row of buttons instead of a menu
const MAX_BUTTONS = 3;

export default {
  name: "SettingRow",
  components: {
    ImportButton,
    OpeningsSettings,
    SettingScrollThreshold,
    SettingsAccount,
    SettingsBackup,
    SettingsEngines,
    ThemeSelector,
  },
  // Where the row's value lives: a dialog's own config, or else the store
  inject: { settingsScope: { default: null } },
  props: {
    entry: { type: Object, required: true },
    // For panels with their own dark or light background
    dark: { type: Boolean, default: null },
    depth: { type: Number, default: 0 },
    // Ids of rows under this one to leave out
    omit: Array,
    // The theme selector reaches the edges, for a menu it sits at the top of
    flush: Boolean,
  },
  computed: {
    scope() {
      return this.settingsScope || storeScope(this.$store);
    },
    state() {
      return entryState(
        this.scope.rootState(),
        this.scope.disabledOptions(),
        this.entry,
        this.scope.byId
      );
    },
    children() {
      const children = this.scope.childrenOf(this.entry.id);
      return this.omit
        ? children.filter((child) => !this.omit.includes(child.id))
        : children;
    },
    // For controls wrapped in a div
    indent() {
      return this.depth ? { paddingLeft: this.depth * INDENT + "px" } : null;
    },
    // For controls that are a q-item
    itemIndent() {
      return this.depth
        ? { paddingLeft: ITEM_PADDING + this.depth * INDENT + "px" }
        : null;
    },
    hotkey() {
      return this.entry.hotkey && this.scope.hotkeys
        ? HOTKEYS_FORMATTED.UI[this.entry.hotkey]
        : "";
    },
    hintText() {
      const disabledHint =
        this.state.locked && disabledHintOf(this.scope.rootState(), this.entry);
      if (disabledHint) {
        return this.$t(disabledHint);
      }
      return this.entry.hint ? this.$t(this.entry.hint) : "";
    },
    options() {
      return (this.entry.options || []).map((option) => ({
        label: this.$t(option.label),
        value: option.value,
        icon: option.icon,
      }));
    },
    // A select shows its options as a row of buttons when there are few
    asButtons() {
      return !this.entry.dropdown && this.options.length <= MAX_BUTTONS;
    },
    buttonOptions() {
      return this.options.map(({ label, value, icon }) => ({
        label,
        value,
        icon,
        attrs: { "data-value": value },
      }));
    },
    // As the dark prop of Quasar's own components falls back
    isDark() {
      return this.dark === null ? this.$q.dark.isActive : this.dark;
    },
    // The entry and its disabled state, for components that take them
    componentProps() {
      const component = this.$options.components[this.entry.component];
      return pick(
        { entry: this.entry, disable: this.state.disabled },
        Object.keys((component && component.props) || {})
      );
    },
    // The current theme's code, if it's a custom one
    customThemeCode() {
      const theme = this.$store.getters["ui/theme"](this.state.value);
      return theme && !theme.isBuiltIn
        ? JSON.stringify(themeForExport(theme))
        : "";
    },
    sliderLabel() {
      const value = this.entry.per
        ? Math.round((this.state.value / this.entry.per) * 100) / 100
        : this.state.value;
      return this.entry.unit ? value + " " + this.$t(this.entry.unit) : value;
    },
  },
  methods: {
    set(value) {
      this.scope.set(this.entry, value);
    },
    // Saves theme code and switches to it, without opening the theme editor
    async importTheme(json) {
      const theme = await this.$store.dispatch("ui/IMPORT_THEME", json);
      this.set(theme.id);
    },
    // Arrow keys move between a row's buttons, wrapping around
    // A button clicked with a pointer gives its focus back, so that the app's
    // hotkeys, which skip a focused row of buttons, work again (shortkey.js).
    // Pressed with Space or Enter (no clicks counted), it keeps it. Quasar
    // focuses the button's focus helper inside it, and may do so after the
    // click: whatever in the row has focus then lets it go.
    blurOnPointer(event) {
      if (event.detail > 0) {
        const row = event.currentTarget;
        const blur = () => {
          const active = document.activeElement;
          if (active && row.contains(active)) {
            active.blur();
          }
        };
        blur();
        this.$nextTick(blur);
      }
    },
    moveFocus(event) {
      const step = {
        ArrowLeft: -1,
        ArrowUp: -1,
        ArrowRight: 1,
        ArrowDown: 1,
      }[event.key];
      const buttons = [
        ...event.currentTarget.querySelectorAll("button:not([disabled])"),
      ];
      const index = buttons.indexOf(document.activeElement);
      if (!step || index < 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      buttons[(index + step + buttons.length) % buttons.length].focus();
    },
    // As v-model.number does
    setNumber(value) {
      const number = parseFloat(value);
      this.set(isNaN(number) ? value : number);
    },
  },
};
</script>

<style lang="scss">
.setting-row .setting-hotkey {
  font-size: 0.8em;
  opacity: 0.7;
  white-space: nowrap;
}

// The label and hint above, the hotkey to their right, and the buttons on a
// line of their own below, so every row of buttons fits the narrowest menu.
// A grid, so the row is only as wide as the wider line, where a wrapping
// flex row would ask for the width of all of them side by side.
.setting-row .setting-buttons-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;

  .setting-buttons {
    grid-column: 1 / -1;
    padding-top: 8px;
  }

  // The buttons share out the row's width, each from its own label's width
  // rather than evenly as spread does, which would widen the menus to fit
  // the longest label as many times over as there are buttons. The unchosen
  // ones are filled as a select's field is.
  .q-btn-toggle {
    display: flex;
    background: rgba(0, 0, 0, 0.05);
    &.setting-buttons--dark {
      background: rgba(255, 255, 255, 0.07);
    }
  }

  .q-btn-toggle > .q-btn {
    flex: 1 1 auto;
  }

  // A disabled row fades once, as its label does, not its buttons again
  &.disabled .q-btn.disabled {
    opacity: 1 !important;
  }

  // Over Quasar's no-outline, for keyboard focus
  .q-btn:focus-visible {
    outline: 2px solid currentColor !important;
    outline-offset: -2px;
  }
}
</style>
