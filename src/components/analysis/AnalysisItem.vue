<template>
  <div
    class="analysis-item"
    :class="{ animate }"
    @mouseover="highlight"
    @mouseout="unhighlight"
  >
    <slot name="before" />
    <div
      v-if="evaluation !== null"
      class="evaluation"
      :class="{ p1: evaluation > 0, p2: evaluation < 0 }"
      :style="{ width: evalPercent + '%' }"
    />
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
                class="depth"
                v-if="depth !== null"
                :class="{
                  single:
                    player1Number === null &&
                    player2Number === null &&
                    middleNumber === null,
                  last: true,
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
            <tooltip v-if="count !== null && seconds">
              {{ $n(count / seconds, "n0") }} {{ $t("analysis.nps") }}
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
      class="column no-wrap q-mr-md"
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

export default {
  name: "AnalysisItem",
  components: { Ply },
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
    animate: Boolean,
    fixedHeight: Boolean,
    expandable: Boolean,
    showContinuation: {
      type: Boolean,
      default: true,
    },
    keepHighlighted: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      expanded: false,
      hasWrapping: false,
    };
  },
  computed: {
    isLimited() {
      return this.fixedHeight && !this.expanded;
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
      if (this.evaluation !== null) {
        this.$store.dispatch("game/SET_EVAL", this.evaluation);
      }
    },
    unhighlight() {
      if (this.ply === null || this.keepHighlighted) {
        return;
      }
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
      // Restore current position's suggestion evaluation
      const suggestion = this.$store.getters["game/suggestion"](this.tps);
      const eval_ =
        suggestion && "evaluation" in suggestion ? suggestion.evaluation : null;
      this.$store.dispatch("game/SET_EVAL", eval_);
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
    tps() {
      this.expanded = false;
    },
  },
  mounted() {
    this.checkWrapping();
  },
};
</script>

<style lang="scss">
.analysis-item {
  position: relative;
  display: flex;
  flex-direction: row;
  overflow-x: hidden;

  + .analysis-item {
    border-top: 1px solid $separator-color;
    body.panelDark & {
      border-top-color: $separator-dark-color;
    }
  }

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
