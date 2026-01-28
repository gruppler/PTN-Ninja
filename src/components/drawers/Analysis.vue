<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <OpeningExplorer />
      <BotAnalysis />
      <PositionNotes />
    </q-scroll-area>
  </component>
</template>

<script>
import OpeningExplorer from "./OpeningExplorer";
import BotAnalysis from "./BotAnalysis";
import PositionNotes from "./PositionNotes";

export default {
  name: "Analysis",
  components: { OpeningExplorer, BotAnalysis, PositionNotes },
  props: {
    recess: Boolean,
  },
};
</script>
