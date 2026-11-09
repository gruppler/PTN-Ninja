<template>
  <div class="settings-section" :data-section="category + '/' + section">
    <q-expansion-item
      v-if="collapsible"
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
      />
    </q-expansion-item>

    <template v-else>
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
      />
    </template>
  </div>
</template>

<script>
import { CATEGORIES, entriesIn } from "../../settings/registry";

export default {
  name: "SettingsSection",
  props: {
    category: { type: String, required: true },
    section: { type: String, required: true },
    // Only these top-level entries, with their children
    ids: Array,
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
      return entriesIn(this.category, this.section, this.ids);
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
