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
  </div>
</template>

<script>
export default {
  name: "EnginesSettings",
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
