<template>
  <!-- Collapsible sections are the expansion item itself, so sibling
       sections' expand-separators work -->
  <q-expansion-item
    v-if="collapsible"
    class="settings-section"
    :data-section="category + '/' + section"
    :value="open"
    @input="$emit('update:open', $event)"
    :label="label"
    expand-separator
    header-class="settings-section-header"
  >
    <setting-row
      v-for="entry in entries"
      :key="entry.id"
      :entry="entry"
      :dark="dark"
      :omit="omit"
    />
  </q-expansion-item>

  <div v-else class="settings-section" :data-section="category + '/' + section">
    <template v-if="!bare">
      <q-separator class="settings-section-separator" />
      <q-item-label class="settings-section-header" header>
        {{ label }}
      </q-item-label>
    </template>
    <setting-row
      v-for="entry in entries"
      :key="entry.id"
      :entry="entry"
      :dark="dark"
      :omit="omit"
    />
  </div>
</template>

<script>
import { CATEGORIES } from "../../settings/registry";
import { storeScope } from "../../settings/scope";

export default {
  name: "SettingsSection",
  // The entries a dialog's own config offers, or else the registry's
  inject: { settingsScope: { default: null } },
  props: {
    category: { type: String, required: true },
    section: { type: String, required: true },
    // Only these top-level entries, with their children
    ids: Array,
    // Ids of rows to leave out, at any depth
    omit: Array,
    // For panels with their own dark or light background; see SettingRow
    dark: { type: Boolean, default: null },
    // Overrides the section's own label
    title: String,
    collapsible: Boolean,
    // No header, for a panel that lists a section's rows on their own
    bare: Boolean,
    open: Boolean,
  },
  computed: {
    label() {
      if (this.title) {
        return this.title;
      }
      const category = CATEGORIES.find((c) => c.id === this.category);
      const section =
        category && category.sections.find((s) => s.id === this.section);
      return section ? this.$t(section.label) : "";
    },
    entries() {
      const scope = this.settingsScope || storeScope(this.$store);
      const entries = scope.entriesIn(this.category, this.section, this.ids);
      return this.omit
        ? entries.filter((entry) => !this.omit.includes(entry.id))
        : entries;
    },
  },
};
</script>

<style lang="scss">
.settings-section {
  &:first-child > .settings-section-separator {
    display: none;
  }
  > .settings-section-header {
    padding-top: 8px;
  }
}
</style>
