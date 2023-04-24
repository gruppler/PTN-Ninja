<template>
  <div class="analysis-item">
    <div
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: Math.abs(evaluation) + '%' }"
    />
    <q-item
      @click="insertPly"
      @mouseover="highlight"
      @mouseout="unhighlight"
      clickable
    >
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
      <q-item-section side>
        <q-item-label v-if="count !== null && countLabel">
          {{ $tc(countLabel, $n(count, "n0")) }}
        </q-item-label>
        <q-item-label>
          <span class="player-numbers">
            <span
              class="player1"
              v-if="player1Number !== null"
              :class="{ single: player2Number === null }"
              >{{ player1Number }}</span
            >
            <span
              class="player2"
              v-if="player2Number !== null"
              :class="{ single: player1Number === null }"
              >{{ player2Number }}</span
            >
          </span>
        </q-item-label>
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
    count: {
      type: Number,
      default: null,
    },
    countLabel: String,
    player1Number: {
      type: [Number, String],
      default: null,
    },
    player2Number: {
      type: [Number, String],
      default: null,
    },
    followingPlies: Array,
  },
  methods: {
    insertPly() {
      this.unhighlight();
      this.$store.dispatch("game/INSERT_PLY", this.ply.text);
    },
    highlight() {
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", this.ply.squares);
    },
    unhighlight() {
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
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

  .player-numbers {
    white-space: nowrap;
    font-weight: bold;
    height: 1.5em;
    margin-top: 4px;
    display: inline-block;
    vertical-align: middle;

    .player1,
    .player2 {
      padding: 2px 6px;
      position: relative;
      &.single {
        border-radius: 4px;
      }
    }

    .player1 {
      border-radius: 4px 0 0 4px;
      background-color: $player1;
      background-color: var(--q-color-player1);
      color: $textDark;
      color: var(--q-color-textDark);
      body.player1Dark & {
        color: $textLight;
        color: var(--q-color-textLight);
      }
    }
    .player2 {
      border-radius: 0 4px 4px 0;
      background-color: $player2;
      background-color: var(--q-color-player2);
      color: $textDark;
      color: var(--q-color-textDark);
      body.player2Dark & {
        color: $textLight;
        color: var(--q-color-textLight);
      }
    }
  }
}
</style>
