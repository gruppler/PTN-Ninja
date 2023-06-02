<template>
  <div class="analysis-item">
    <div
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: Math.abs(evaluation) + '%' }"
    />
    <q-item
      @mouseover="highlight"
      @mouseout="unhighlight"
      @click="insertPly"
      clickable
    >
      <q-item-section>
        <q-item-label>
          <Ply :ply="ply" no-click />
        </q-item-label>
      </q-item-section>
      <q-item-section side>
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
        <q-item-label v-if="count !== null && countLabel">
          {{ $tc(countLabel, $n(count, "n0")) }}
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item
      v-if="followingPlies && followingPlies.length"
      class="q-pt-none"
      @mouseover="highlight"
      @mouseout="unhighlight"
      @click="insertFollowingPlies"
      clickable
    >
      <q-item-label class="small">
        <Ply v-for="(ply, i) in followingPlies" :key="i" :ply="ply" no-click />
      </q-item-label>
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
    insertFollowingPlies(i) {
      this.unhighlight();
      this.$store.dispatch("game/INSERT_PLIES", [
        this.ply.text,
        ...this.followingPlies.map((ply) => ply.text),
      ]);
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
