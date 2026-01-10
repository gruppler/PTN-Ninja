<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <BotAnalysis />
      <OpeningExplorer />
    </q-scroll-area>
  </component>
</template>

<script>
import BotAnalysis from "./BotAnalysis";
import OpeningExplorer from "./OpeningExplorer";

export default {
  name: "Analysis",
  components: { BotAnalysis, OpeningExplorer },
  props: {
    recess: Boolean,
  },
};
</script>
