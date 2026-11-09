<template>
  <div :class="textClass">
    <settings-section
      category="notifications"
      section="notifications"
      :ids="['ui:notifyNotes']"
      :dark="dark"
      bare
    />
  </div>
</template>

<script>
export default {
  name: "NotesSettings",
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
