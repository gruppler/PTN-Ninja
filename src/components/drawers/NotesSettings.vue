<template>
  <div :class="textClass">
    <settings-section
      category="notifications"
      section="notifications"
      :ids="['ui:notifyNotes']"
      :dark="dark"
      bare
    />
    <settings-link category="notifications" />
  </div>
</template>

<script>
import SettingsLink from "../settings/SettingsLink";

export default {
  name: "NotesSettings",
  components: { SettingsLink },
  computed: {
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textClass() {
      return this.$store.state.ui.theme.panelDark
        ? "text-textLight"
        : "text-textDark";
    },
  },
};
</script>
