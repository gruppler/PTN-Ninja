<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <OpeningExplorer />
    </q-scroll-area>
  </component>
</template>

<script>
import OpeningExplorer from "./OpeningExplorer";

export default {
  name: "Openings",
  components: { OpeningExplorer },
  props: {
    recess: Boolean,
  },
};
</script>
