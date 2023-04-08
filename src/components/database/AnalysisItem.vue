<template>
  <div class="analysis-item">
    <div
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: Math.abs(evaluation) + '%' }"
    />
    <q-item @click="insertPly" clickable>
      <q-item-section>
        <q-item-label class="ptn">
          <Ply :ply="ply" />
        </q-item-label>
        <q-item-label v-if="followingPlies && followingPlies.length" caption>
          <Ply
            v-for="(ply, i) in followingPlies"
            :key="i"
            :ply="ply"
            v-on:click="insertFollowingPlies(i)"
          />
        </q-item-label>
      </q-item-section>
      <q-item-section v-if="$slots.after" side>
        <slot name="after" />
      </q-item-section>
    </q-item>
  </div>
</template>

<script>
import Ply from "../PTN/Ply";

export default {
  name: "AnalysisItem",
  components: { Ply },
  props: {
    ply: Object,
    evaluation: Number,
    followingPlies: Array,
  },
  methods: {
    insertPly() {
      this.$store.dispatch("game/INSERT_PLY", this.ply.text);
    },
    applicablePlies(i) {
      return [this.ply.text, ...this.followingPlies.slice(0, i + 1)];
    },
    insertFollowingPlies(i) {
      for (const mv of this.applicablePlies(i)) {
        this.insertPly(mv);
      }
    },
  },
};
</script>

<style lang="scss">
.analysis-item {
  position: relative;
  .evaluation {
    position: absolute;
    height: 100%;
  }
}
</style>
