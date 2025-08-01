<template>
  <div class="analysis-item" :class="{ animate }">
    <div
      v-if="evaluation !== null"
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: evalPercent + '%' }"
    />
    <q-item
      @mouseover="highlight"
      @mouseout="unhighlight"
      @click="insertPly"
      :clickable="!isBoardDisabled && ply !== null"
      style="height: 60px"
    >
      <q-item-section>
        <q-item-label v-if="ply !== null">
          <Ply :ply="ply" no-click done>
            <PlyPreview
              :tps="tps"
              :plies="[ply.text]"
              :options="$store.state.game.config"
            />
          </Ply>
        </q-item-label>
      </q-item-section>
      <q-item-section top side>
        <q-item-label>
          <span class="visits" v-if="visits !== null">
            {{ $tc("analysis.visits", $n(visits, "n0")) }}
          </span>
          <span
            class="player-numbers"
            v-if="
              middleNumber !== null ||
              player1Number !== null ||
              player2Number !== null ||
              depth !== null
            "
          >
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
        <q-item-label
          v-if="(count !== null && countLabel) || seconds !== null"
          class="count"
          caption
        >
          <template v-if="count !== null && countLabel">{{
            $tc(countLabel, $n(count, "n0"))
          }}</template>
          <template v-if="count !== null && seconds !== null"> / </template>
          <template v-if="seconds !== null">
            {{ $n(seconds, seconds >= 10 ? "n0" : "n2") }}
            {{ $t("analysis.secondsUnit") }}
          </template>
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item
      v-if="fixedHeight || (followingPlies && followingPlies.length > 0)"
      class="q-pt-none"
      @mouseover="highlight"
      @mouseout="unhighlight"
      @click="
        followingPlies && followingPlies.length > 0
          ? insertFollowingPlies()
          : null
      "
      :clickable="
        !isBoardDisabled && followingPlies && followingPlies.length > 0
      "
    >
      <q-item-label
        class="continuation small"
        :class="{ limited: fixedHeight }"
      >
        <Ply
          v-for="(fPly, i) in followingPlies"
          :key="i"
          :ply="fPly"
          :no-click="isBoardDisabled"
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
    followingPlies: Array,
    evaluation: Number,
    count: {
      type: Number,
      default: null,
    },
    countLabel: {
      type: String,
      default: null,
    },
    depth: {
      type: Number,
      default: null,
    },
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
    playerNumbersTooltip: {
      type: String,
      default: null,
    },
    seconds: {
      type: Number,
      default: null,
    },
    visits: {
      type: Number,
      default: null,
    },
    animate: Boolean,
    fixedHeight: Boolean,
  },
  computed: {
    isBoardDisabled() {
      return this.$store.state.ui.disableBoard;
    },
    tps() {
      return this.$store.state.game.position.tps;
    },
    evalPercent() {
      return Math.max(0, Math.min(100, Math.abs(this.evaluation)));
    },
  },
  methods: {
    insertPly() {
      if (this.ply === null || this.isBoardDisabled) {
        return;
      }
      this.unhighlight();
      this.$store.dispatch("game/INSERT_PLY", this.ply.text);
    },
    highlight() {
      if (this.ply === null) {
        return;
      }
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", this.ply.squares);
    },
    unhighlight() {
      if (this.ply === null) {
        return;
      }
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
    },
    insertFollowingPlies(index) {
      if (this.ply === null || this.isBoardDisabled) {
        return;
      }
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
    will-change: width, background-color, opacity;
    &:not(.p1):not(.p2) {
      opacity: 0.3;
    }
  }

  &.animate .evaluation {
    transition-duration: $transition-duration;
    transition-timing-function: $transition-easing;
    transition-property: width, background-color, opacity;
  }

  .continuation {
    &.limited {
      overflow: hidden;
      height: 2em;
    }
  }

  .visits + .player-numbers {
    margin-left: 0.5em;
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
      background-color: var(--q-color-player1);
      color: var(--q-color-textDark);
      body.player1Dark & {
        color: var(--q-color-textLight);
      }
    }
    .middle,
    .depth {
      background-color: $highlight;
      color: var(--q-color-textDark);
      body.panelDark & {
        color: var(--q-color-textLight);
        background-color: $dim;
      }
    }
    .player2 {
      background-color: var(--q-color-player2);
      color: var(--q-color-textDark);
      body.player2Dark & {
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

  .count {
    color: var(--q-color-textDark);
    body.panelDark & {
      color: var(--q-color-textLight);
    }
  }
}
</style>
