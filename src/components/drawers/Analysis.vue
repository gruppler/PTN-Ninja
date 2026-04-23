<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="absolute-fit analysis-scroll">
      <BotAnalysis />
    </q-scroll-area>
  </component>
</template>

<script>
import BotAnalysis from "./BotAnalysis";

export default {
  name: "Analysis",
  components: { BotAnalysis },
  props: {
    recess: Boolean,
  },
};
</script>

<style lang="scss">
.analysis-scroll > .q-scrollarea__thumb {
  z-index: 3;
}
</style>
