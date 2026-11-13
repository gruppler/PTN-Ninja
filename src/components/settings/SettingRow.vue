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
import SettingsEngines from "./SettingsEngines";
import ImportButton from "../controls/ImportButton";
import ThemeSelector from "../controls/ThemeSelector";

import { pick } from "lodash";
import { themeForExport } from "../../themes";
import { HOTKEYS_FORMATTED } from "../../keymap";
import { childrenOf, entryState, setValue } from "../../settings/registry";

// Children's extra left padding, per level
const INDENT = 24;
// A q-item's own left padding, which an indented q-item replaces
const ITEM_PADDING = 16;

export default {
  name: "SettingRow",
  components: {
    ImportButton,
    OpeningsSettings,
    SettingScrollThreshold,
    SettingsAccount,
    SettingsEngines,
    ThemeSelector,
  },
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
    state() {
      return entryState(
        this.$store.state,
        this.$store.getters["game/disabledOptions"],
        this.entry
      );
    },
    children() {
      const children = childrenOf(this.entry.id);
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
      return this.entry.hotkey ? HOTKEYS_FORMATTED.UI[this.entry.hotkey] : "";
    },
    hintText() {
      if (this.state.locked && this.entry.disabledHint) {
        return this.$t(this.entry.disabledHint);
      }
      return this.entry.hint ? this.$t(this.entry.hint) : "";
    },
    options() {
      return (this.entry.options || []).map((option) => ({
        label: this.$t(option.label),
        value: option.value,
      }));
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
      return this.entry.unit
        ? this.state.value + " " + this.$t(this.entry.unit)
        : this.state.value;
    },
  },
  methods: {
    set(value) {
      setValue(this.$store.dispatch, this.entry, value);
    },
    // Saves theme code and switches to it, without opening the theme editor
    async importTheme(json) {
      const theme = await this.$store.dispatch("ui/IMPORT_THEME", json);
      this.set(theme.id);
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
</style>
