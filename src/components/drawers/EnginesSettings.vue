<template>
  <div :class="'text-' + textColor">
    <settings-section
      category="analysis"
      section="suggestions"
      :dark="dark"
      bare
    />
    <settings-section
      category="analysis"
      section="onBoard"
      :ids="['analysis:showEvalMarks']"
      :dark="dark"
      bare
    />
    <q-separator :dark="dark" />
    <settings-link category="analysis" section="suggestions" />
  </div>
</template>

<script>
import SettingsLink from "../settings/SettingsLink";

export default {
  name: "EnginesSettings",
  components: { SettingsLink },
  computed: {
    dark() {
      return this.$store.state.ui.theme.isDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
  },
};
</script>
