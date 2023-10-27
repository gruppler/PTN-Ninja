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
          <Ply :ply="ply" no-click done>
            <PlyPreview :game="getGame()" />
          </Ply>
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-item-label>
          <span class="player-numbers">
            <span
              class="player1"
              v-if="player1Number !== null"
              :class="{
                single: player2Number === null && middleNumber === null,
              }"
              >{{ player1Number }}</span
            >
            <span
              class="middle"
              v-if="middleNumber !== null"
              :class="{
                single: player1Number === null && player2Number === null,
                first: player1Number === null,
                last: player2Number === null,
              }"
              >{{ middleNumber }}</span
            >
            <span
              class="player2"
              v-if="player2Number !== null"
              :class="{
                single: player1Number === null && middleNumber === null,
              }"
              >{{ player2Number }}</span
            >
            <tooltip v-if="playerNumbersTooltip">
              <span style="white-space: pre">{{ playerNumbersTooltip }}</span>
            </tooltip>
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
      @click="insertFollowingPlies()"
      clickable
    >
      <q-item-label class="small">
        <Ply
          v-for="(ply, i) in followingPlies"
          :key="i"
          :ply="ply"
          @click.stop.prevent.capture="
            insertFollowingPlies(followingPlies.length - i - 1)
          "
          @click.right.stop.prevent
        >
          <PlyPreview :game="getGame(i + 1)" />
        </Ply>
      </q-item-label>
    </q-item>
  </div>
</template>

<script>
import Game from "../../Game";
import Ply from "../PTN/Ply";
import PlyPreview from "../controls/PlyPreview";

export default {
  name: "AnalysisItem",
  components: { Ply, PlyPreview },
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
    middleNumber: {
      type: [Number, String],
      default: null,
    },
    player2Number: {
      type: [Number, String],
      default: null,
    },
    playerNumbersTooltip: String,
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
    insertFollowingPlies(prev) {
      if (prev === undefined) {
        prev = this.followingPlies.length;
      }
      this.unhighlight();
      this.$store.dispatch("game/INSERT_PLIES", {
        plies: [this.ply.text, ...this.followingPlies.map((ply) => ply.text)],
        prev,
      });
    },
    getGame(followingPlies = 0) {
      let game = new Game({
        name: "analysis",
        state: this.$store.state.game.position,
        tags: {
          tps: this.$store.state.game.position.tps,
          komi: this.$store.state.game.config.komi,
          opening: this.$store.state.game.config.opening,
        },
        config: this.$store.state.game.config,
      });
      let plies = [this.ply];
      if (followingPlies && this.followingPlies) {
        plies.push(...this.followingPlies.slice(0, followingPlies));
      }
      game.insertPlies(plies.map((ply) => ply.ptn));
      return game;
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
    .middle,
    .player2 {
      padding: 2px 6px;
      position: relative;
      &.single {
        border-radius: 4px !important;
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
    .middle {
      background-color: $dim;
      body.body--light & {
        background-color: $highlight;
      }
      &.first {
        border-radius: 4px 0 0 4px;
      }
      &.last {
        border-radius: 0 4px 4px 0;
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
