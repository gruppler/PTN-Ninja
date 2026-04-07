<template>
  <div
    class="analysis-item"
    :class="{ animate }"
    @mouseover="highlight($event)"
    @mouseout="unhighlight"
    @mouseup="forceUnhighlight"
    @touchstart="onTouchStart"
    @touchend="forceUnhighlight"
    @touchcancel="forceUnhighlight"
  >
    <div v-if="evalBarWdl" class="evaluation">
      <WdlBar
        :wdl="evalBarWdl"
        :evaluation="evaluation"
        :mode="showWdlBars ? 'wdl' : 'single'"
      />
    </div>
    <slot name="before" />
    <div class="full-width">
      <q-item
        @click="insertPly"
        :clickable="!isBoardDisabled && ply !== null"
        :class="{ 'q-pr-xs': showAfterColumn }"
        style="height: 60px"
      >
        <q-item-section class="no-wrap">
          <q-item-label v-if="botName !== null" caption>
            <span class="bot-name">{{ botName }}</span>
          </q-item-label>
          <q-item-label v-if="ply !== null">
            <Ply
              :ply="ply"
              no-click
              :selected="selectedCount > 0"
              :done="doneCount > 0"
              :tps="tps"
              :plies="ply && ply.text ? [ply.text] : null"
            />
          </q-item-label>
        </q-item-section>
        <q-item-section class="analysis-item-side" top side>
          <q-item-label>
            <span class="visits" v-if="visits !== null">
              {{ $tc("analysis.visits", visits, { count: $n(visits, "n0") }) }}
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
                class="depth"
                v-if="depth !== null"
                :class="{
                  single:
                    player1Number === null &&
                    player2Number === null &&
                    middleNumber === null,
                  last: true,
                }"
                >d{{ $n(depth, "n0") }}</span
              >
              <tooltip v-if="playerNumbersTooltip">
                <span style="white-space: pre">{{ playerNumbersTooltip }}</span>
              </tooltip>
            </span>
          </q-item-label>
          <q-item-label
            v-if="
              (count !== null && countLabel && !hideCount) ||
              (seconds !== null && !hideSeconds)
            "
            class="count"
            caption
          >
            <template v-if="count !== null && countLabel && !hideCount">{{
              $tc(displayCountLabel, displayCount, {
                count: $n(displayCount, "n0"),
              })
            }}</template>
            <template
              v-if="
                count !== null && !hideCount && seconds !== null && !hideSeconds
              "
            >
              /
            </template>
            <template v-if="seconds !== null && !hideSeconds">
              {{ $n(seconds, seconds >= 10 ? "n0" : "n2") }}
              {{ $t("analysis.secondsUnit") }}
            </template>
            <tooltip
              v-if="count !== null && !hideCount && seconds && !hideSeconds"
            >
              {{ $n(displayNps, "n0") }} {{ $t(displayNpsLabel) }}
            </tooltip>
          </q-item-label>
        </q-item-section>
      </q-item>
      <smooth-reflow height-only>
        <q-item
          v-if="showSecondRow"
          class="q-pt-none"
          :class="{ 'q-pr-xs': showAfterColumn }"
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
            ref="continuation"
            class="continuation small"
            :class="{ limited: isLimited }"
          >
            <Ply
              v-for="(fPly, i) in followingPlies"
              ref="plies"
              :key="i"
              :ply="fPly"
              :no-click="isBoardDisabled"
              @click.stop.prevent.capture="insertFollowingPlies(i)"
              :selected="selectedCount > i + 1"
              :done="doneCount > i + 1"
              :tps="tps"
              :plies="tps ? getPlySequence(i) : null"
            />
          </q-item-label>
        </q-item>
      </smooth-reflow>
    </div>
    <div
      v-if="showAfterColumn"
      class="column no-wrap analysis-after-column"
      :style="{ maxHeight: showSecondRow ? '' : '60px', overflow: 'hidden' }"
    >
      <slot name="after" />

      <q-btn
        v-if="expandable && showExpandButton"
        @click.stop="expanded = !expanded"
        :icon="expanded ? 'arrow_drop_up' : 'arrow_drop_down'"
        class="expand-btn q-mt-auto"
        :color="$store.state.ui.theme.panelDark ? 'textLight' : 'textDark'"
        flat
        dense
      >
        <hint>{{ $t(expanded ? "Less" : "More") }}</hint>
      </q-btn>
    </div>
  </div>
</template>

<script>
import Ply from "../PTN/Ply";
import WdlBar from "../WdlBar";
import { normalizeWDL } from "../../bots/wdl";

export default {
  name: "AnalysisItem",
  components: { Ply, WdlBar },
  props: {
    ply: Object,
    followingPlies: Array,
    evaluation: Number,
    wdl: {
      type: [Object, Array],
      default: null,
    },
    showWdlBars: {
      type: Boolean,
      default: false,
    },
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
    botName: {
      type: String,
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
    doneCount: {
      type: Number,
      default: 1,
    },
    selectedCount: {
      type: Number,
      default: 0,
    },
    fixedHeight: Boolean,
    expandable: Boolean,
    engineKey: {
      type: String,
      default: null,
    },
    pvIndex: {
      type: [Number, String],
      default: null,
    },
    showContinuation: {
      type: Boolean,
      default: true,
    },
    keepHighlighted: {
      type: Boolean,
      default: false,
    },
    hideCount: {
      type: Boolean,
      default: false,
    },
    hideSeconds: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      hasWrapping: false,
      suppressMouseHoverUntil: 0,
    };
  },
  computed: {
    expanded: {
      get() {
        if (!this.expandable) {
          return false;
        }
        if (this.pvIndex === null || this.pvIndex === undefined) {
          return false;
        }
        const engineKey = this.engineKey != null ? this.engineKey : "";
        const indexKey = String(this.pvIndex);
        return (
          this.$store.state.analysis.expandSuggestionPVs?.[engineKey]?.[
            indexKey
          ] === true
        );
      },
      set(value) {
        if (!this.expandable) {
          return;
        }
        if (this.pvIndex === null || this.pvIndex === undefined) {
          return;
        }
        this.$store.dispatch("analysis/SET_SUGGESTION_PV_EXPANDED", {
          engineKey: this.engineKey,
          pvIndex: this.pvIndex,
          expanded: value,
        });
      },
    },
    isLimited() {
      return this.fixedHeight && !this.expanded;
    },
    animate() {
      return (
        this.$store.state.ui.animateBoard && !this.$store.state.ui.scrubbing
      );
    },
    showAfterColumn() {
      return this.$slots.after || (this.expandable && this.showExpandButton);
    },
    showSecondRow() {
      return (
        (this.showContinuation || this.expanded) &&
        (this.fixedHeight ||
          (this.followingPlies && this.followingPlies.length > 0))
      );
    },
    showExpandButton() {
      const hasContinuation =
        this.followingPlies && this.followingPlies.length > 0;
      if (!hasContinuation) return false;
      return !this.showContinuation || (this.fixedHeight && this.hasWrapping);
    },
    isBoardDisabled() {
      return this.$store.state.ui.disableBoard;
    },
    tps() {
      const position = this.$store.state.game.position;
      return position ? position.tps : null;
    },
    evalBarWdl() {
      return normalizeWDL(this.wdl, this.evaluation);
    },
    isNodeCount() {
      return this.countLabel === "analysis.nodes";
    },
    displayCount() {
      if (this.count === null) {
        return null;
      }
      return this.isNodeCount ? this.count / 1e3 : this.count;
    },
    displayCountLabel() {
      return this.isNodeCount ? "analysis.knodes" : this.countLabel;
    },
    displayNps() {
      if (this.count === null || !this.seconds) {
        return null;
      }
      return this.isNodeCount
        ? this.count / this.seconds / 1e3
        : this.count / this.seconds;
    },
    displayNpsLabel() {
      return this.isNodeCount ? "analysis.knps" : "analysis.nps";
    },
  },
  methods: {
    onTouchStart() {
      this.suppressMouseHoverUntil = Date.now() + 600;
    },
    insertPly() {
      if (!this.ply || this.isBoardDisabled) {
        return;
      }
      this.unhighlight();
      this.$store.dispatch("game/INSERT_PLY", this.ply.text);
    },
    highlight(event) {
      if (!this.ply) {
        return;
      }
      if (
        event &&
        event.type &&
        event.type.startsWith("mouse") &&
        Date.now() < this.suppressMouseHoverUntil
      ) {
        return;
      }
      this.$store.commit(
        "analysis/SET_HOVERED_OVERLAY_PLY_TEXT",
        this.ply.text
      );
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", this.ply.squares);
      if (this.evaluation !== null || this.wdl !== null) {
        this.$store.dispatch("game/SET_EVAL", {
          evaluation: this.evaluation,
          wdl: this.wdl,
        });
      }
    },
    unhighlight() {
      if (!this.ply || this.keepHighlighted) {
        return;
      }
      this.$store.commit("analysis/SET_HOVERED_OVERLAY_PLY_TEXT", null);
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
      // Restore current position's evaluation based on preferSavedResults
      const eval_ = this.$store.getters["game/evaluationForTps"](this.tps);
      const wdl = this.$store.getters["game/wdlForTps"](this.tps);
      this.$store.dispatch("game/SET_EVAL", {
        evaluation: eval_,
        wdl,
      });
    },
    forceUnhighlight() {
      if (!this.ply) {
        return;
      }
      this.$store.commit("analysis/SET_HOVERED_OVERLAY_PLY_TEXT", null);
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
      const eval_ = this.$store.getters["game/evaluationForTps"](this.tps);
      const wdl = this.$store.getters["game/wdlForTps"](this.tps);
      this.$store.dispatch("game/SET_EVAL", {
        evaluation: eval_,
        wdl,
      });
      this.$emit("force-unhighlight");
    },
    insertFollowingPlies(index) {
      if (!this.ply || this.isBoardDisabled) {
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
    getPlySequence(index) {
      return [
        this.ply.text,
        ...this.followingPlies.slice(0, index + 1).map((p) => p.text),
      ];
    },
    checkWrapping() {
      this.$nextTick(() => {
        const container = this.$refs.continuation;
        if (!container || !this.$refs.plies) {
          this.hasWrapping = false;
          return;
        }
        const plies = this.$refs.plies.map((ply) => ply.$el);
        if (plies.length < 2) {
          this.hasWrapping = false;
          return;
        }
        const firstRect = plies[0].getBoundingClientRect();
        const lastRect = plies[plies.length - 1].getBoundingClientRect();
        this.hasWrapping = Math.abs(firstRect.top - lastRect.top) > 2;
      });
    },
  },
  watch: {
    followingPlies: {
      handler() {
        this.checkWrapping();
      },
      immediate: true,
    },
    showContinuation() {
      this.checkWrapping();
    },
    expanded() {
      this.checkWrapping();
    },
    keepHighlighted(val) {
      if (!val) {
        this.unhighlight();
      }
    },
  },
  mounted() {
    this.checkWrapping();
  },
  beforeDestroy() {
    if (
      this.ply &&
      this.$store.state.analysis.hoveredOverlayPlyText === this.ply.text
    ) {
      this.$store.commit("analysis/SET_HOVERED_OVERLAY_PLY_TEXT", null);
    }
  },
};
</script>

<style lang="scss">
.analysis-item {
  position: relative;
  display: flex;
  flex-direction: row;
  overflow-x: hidden;

  > .full-width {
    flex: 1 1 auto;
    min-width: 0;
    width: auto;
  }

  .q-item {
    min-width: 0;
  }

  .analysis-item-side {
    padding-left: 6px;
  }

  .analysis-after-column {
    margin-right: 12px;
  }

  + .analysis-item {
    border-top: 1px solid $separator-color;
    body.panelDark & {
      border-top-color: $separator-dark-color;
    }
  }

  .evaluation {
    position: absolute;
    height: 100%;
    width: 100%;
    will-change: opacity;
  }

  &.animate .evaluation .segment {
    transition: width $transition-duration $transition-easing,
      background-color $transition-duration $transition-easing,
      opacity $transition-duration $transition-easing;
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
      padding: 2px 4px;
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

  @media (max-width: 700px) {
    .analysis-item-side {
      padding-left: 2px;
    }

    .analysis-after-column {
      margin-right: 4px;
    }
  }
}
</style>
