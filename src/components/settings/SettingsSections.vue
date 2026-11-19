<template>
  <div class="settings-sections">
    <settings-section
      v-for="s in sections"
      :key="s.category.id + '/' + s.section.id"
      :category="s.category.id"
      :section="s.section.id"
      :title="title(s)"
    />
  </div>
</template>

<script>
import { CATEGORIES } from "../../settings/registry";

/**
 * Every section that has rows in the provided settings scope, in the
 * Settings dialog's order, each titled with its category and section as
 * Settings' search results are, since sections of different categories
 * can share a name; with the category's name alone where the section's
 * would only repeat it ("Notifications").
 */
export default {
  name: "SettingsSections",
  inject: { settingsScope: { default: null } },
  methods: {
    // The category's name alone when the section's is the same, or the
    // category has no other section
    title({ category, section }) {
      const categoryLabel = this.$t(category.label);
      const sectionLabel = this.$t(section.label);
      return sectionLabel === categoryLabel || category.sections.length === 1
        ? categoryLabel
        : categoryLabel + " › " + sectionLabel;
    },
  },
  computed: {
    sections() {
      const scope = this.settingsScope;
      return CATEGORIES.flatMap((category) =>
        category.sections
          .filter(
            (section) =>
              !scope || scope.entriesIn(category.id, section.id).length
          )
          .map((section) => ({ category, section }))
      );
    },
  },
};
</script>

<style lang="scss">
// The dialog's own rows come before these, so the first one is divided too
.settings-sections
  > .settings-section:first-child
  > .settings-section-separator {
  display: block;
}
</style>
