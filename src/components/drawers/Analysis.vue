<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <OpeningExplorer />
      <BotAnalysis />
    </q-scroll-area>
  </component>
</template>

<script>
import OpeningExplorer from "./OpeningExplorer";
import BotAnalysis from "./BotAnalysis";

export default {
  name: "Analysis",
  components: { OpeningExplorer, BotAnalysis },
  props: {
    recess: Boolean,
  },
};
</script>
