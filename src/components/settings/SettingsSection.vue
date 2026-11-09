<template>
  <div class="settings-section" :data-section="category + '/' + section">
    <q-expansion-item
      v-if="collapsible"
      :value="open"
      @input="$emit('update:open', $event)"
      :label="label"
      :caption="open ? '' : $t('settings.countOn', { n: countOn })"
      header-class="settings-section-header"
    >
      <setting-row
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
        :quick="quick"
      />
    </q-expansion-item>

    <template v-else>
      <q-item-label class="settings-section-header" header>
        {{ label }}
      </q-item-label>
      <setting-row
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
        :quick="quick"
      />
    </template>
  </div>
</template>

<script>
import {
  CATEGORIES,
  childrenOf,
  entriesIn,
  entryState,
} from "../../settings/registry";

export default {
  name: "SettingsSection",
  props: {
    category: { type: String, required: true },
    section: { type: String, required: true },
    // Only these top-level entries, with their children
    ids: Array,
    // The quick board menu; see SettingRow
    quick: Boolean,
    collapsible: Boolean,
    open: Boolean,
  },
  computed: {
    label() {
      const category = CATEGORIES.find((c) => c.id === this.category);
      const section =
        category && category.sections.find((s) => s.id === this.section);
      return section ? this.$t(section.label) : "";
    },
    entries() {
      return entriesIn(this.category, this.section, this.ids);
    },
    // How many shown toggles in the section are on, children included
    countOn() {
      const rootState = this.$store.state;
      const disabledOptions = this.$store.getters["game/disabledOptions"];
      let count = 0;
      const visit = (entry) => {
        const state = entryState(rootState, disabledOptions, entry, this.quick);
        if (state.hidden) {
          return;
        }
        if (entry.control === "toggle" && state.value) {
          count++;
        }
        childrenOf(entry.id).forEach(visit);
      };
      this.entries.forEach(visit);
      return count;
    },
  },
};
</script>
