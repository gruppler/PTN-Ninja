<template>
  <div class="analysis-item" :class="{ animate }">
    <div
      v-if="evaluation !== null"
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
            <PlyPreview
              :tps="tps"
              :plies="[ply.text]"
              :options="$store.state.game.config"
            />
          </Ply>
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-item-label>
          <span class="player-numbers">
            <span
              class="player1 first"
              v-if="player1Number !== null"
              :class="{
                single:
                  player2Number === null &&
                  middleNumber === null &&
                  depth === null,
              }"
              >{{ player1Number }}</span
            >
            <span
              class="middle"
              v-if="middleNumber !== null"
              :class="{
                single:
                  player1Number === null &&
                  player2Number === null &&
                  depth === null,
                first: player1Number === null,
                last: player2Number === null && depth === null,
              }"
              >{{ middleNumber }}</span
            >
            <span
              class="player2"
              v-if="player2Number !== null"
              :class="{
                single:
                  player1Number === null &&
                  middleNumber === null &&
                  depth === null,
                first: player1Number === null && middleNumber === null,
                last: depth == null,
              }"
              >{{ player2Number }}</span
            >
            <span
              class="depth last"
              v-if="depth !== null"
              :class="{
                single:
                  player1Number === null &&
                  player2Number === null &&
                  middleNumber === null,
              }"
              >{{ $t("analysis.depth") }} {{ $n(depth, "n0") }}</span
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
          v-for="(fPly, i) in followingPlies"
          :key="i"
          :ply="fPly"
          @click.stop.prevent.capture="insertFollowingPlies(i)"
        >
          <PlyPreview
            :tps="tps"
            :plies="[ply, ...followingPlies.slice(0, i + 1)].map((p) => p.text)"
            :options="$store.state.game.config"
          />
        </Ply>
      </q-item-label>
    </q-item>
  </div>
</template>

<script>
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
    depth: {
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
    animate: Boolean,
  },
  computed: {
    tps() {
      return this.$store.state.game.position.tps;
    },
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
    insertFollowingPlies(index) {
      let prev = 0;
      if (index === undefined) {
        index = this.followingPlies.length;
        prev = index;
      }
      this.unhighlight();
      this.$store.dispatch("game/INSERT_PLIES", {
        plies: [
          this.ply.text,
          ...this.followingPlies.slice(0, index + 1).map((ply) => ply.text),
        ],
        prev,
      });
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
    will-change: width, background-color;
  }

  &.animate .evaluation {
    transition: width $generic-hover-transition,
      background-color $generic-hover-transition;
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
    .player2,
    .depth {
      padding: 2px 6px;
      position: relative;
    }

    .player1 {
      background-color: $player1;
      background-color: var(--q-color-player1);
      color: $textDark;
      color: var(--q-color-textDark);
      body.player1Dark & {
        color: $textLight;
        color: var(--q-color-textLight);
      }
    }
    .middle,
    .player2,
    .depth {
      background-color: $dim;
      body.body--light & {
        background-color: $highlight;
      }
    }
    .player2 {
      background-color: $player2;
      background-color: var(--q-color-player2);
      color: $textDark;
      color: var(--q-color-textDark);
      body.player2Dark & {
        color: $textLight;
        color: var(--q-color-textLight);
      }
    }

    .first {
      border-radius: 4px 0 0 4px;
    }
    .last {
      border-radius: 0 4px 4px 0;
    }
    .single {
      border-radius: 4px !important;
    }
  }
}
</style>
