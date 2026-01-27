<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <BotAnalysis />
      <OpeningExplorer />
      <PositionNotes />
    </q-scroll-area>
  </component>
</template>

<script>
import BotAnalysis from "./BotAnalysis";
import OpeningExplorer from "./OpeningExplorer";
import PositionNotes from "./PositionNotes";

export default {
  name: "Analysis",
  components: { BotAnalysis, OpeningExplorer, PositionNotes },
  props: {
    recess: Boolean,
  },
};
</script>
