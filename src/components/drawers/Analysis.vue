<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <BotSuggestions />
      <OpeningExplorer />
    </q-scroll-area>
  </component>
</template>

<script>
import BotSuggestions from "./BotSuggestions";
import OpeningExplorer from "./OpeningExplorer";

export default {
  name: "Analysis",
  components: { BotSuggestions, OpeningExplorer },
  props: {
    recess: Boolean,
  },
};
</script>
