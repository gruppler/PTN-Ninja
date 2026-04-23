<template>
  <div
    class="board-space absolute-fit"
    :class="{ 'board-3D': board3D, orthographic }"
    :style="{
      perspective,
      '--board-size': config.size,
      '--square-size': `calc(${squareSize || 100}px / ${config.size})`,
      '--board-size-grid': config.size + 'fr',
    }"
    v-touch-pan.prevent.mouse="board3D ? rotateBoard : null"
    @click.right.self.prevent="resetBoardRotation"
    @wheel="scroll"
    ref="wrapper"
  >
    <div
      ref="container"
      class="board-container"
      :class="{
        [style]: true,
        ['size-' + config.size]: true,
        ['turn-' + turn]: true,
        'no-animations': disableAnimations,
        'show-turn-indicator': $store.state.ui.turnIndicator,
        'show-move-number': $store.state.ui.moveNumber,
        'highlight-squares': $store.state.ui.highlightSquares,
        highlighter: isHighlighting,
        'show-unplayed-pieces': $store.state.ui.unplayedPieces,
        eog: position.isGameEnd && !position.isGameEndDefault,
        flatwin: position.isGameEndFlats,
        'pieces-selected': selected.pieces.length > 0,
        'rotate-1': transform[0] === 1,
        'rotate-2': transform[0] === 2,
        'rotate-3': transform[0] === 3,
        flip: transform[1] === 1,
        scrubbing,
        rotating,
        horizontal: !isVertical,
        vertical: isVertical,
      }"
      :style="{
        width,
        transform: CSS3DTransform,
        'margin-top': topDeadSpace ? topDeadSpace + 'px' : 'auto',
        'margin-bottom': 'auto',
      }"
      @click.right.self.prevent="resetBoardRotation"
      v-shortkey="disableHotkeys ? null : hotkeys"
      @shortkey="shortkey"
    >
      <GameTimer v-if="showGameTimer" />
      <TurnIndicator :hide-names="hideNames" />

      <div v-if="showMoveNumber" class="move-number-container">
        <span v-if="showMoveNumber" class="move-number"
          >&nbsp;&nbsp;{{ moveNumber }}.&nbsp;</span
        >
        <span
          v-if="$store.state.ui.evalText && evaluationText"
          class="eval-text"
          :class="{ absolute: showMoveNumber }"
          >{{ evaluationText.slice(0, 6) }}</span
        >
      </div>

      <div
        class="unplayed-bg all-pointer-events"
        :class="{ vertical: isVertical, horizontal: !isVertical }"
        @click.self="dropPiece"
        @click.right.prevent
        @touchstart.stop
        @mousedown.stop
      >
        <div
          v-if="showEvaluation && boardEvalWdl"
          @click.self="dropPiece"
          class="evaluation"
        >
          <WdlBar
            :wdl="boardEvalWdl"
            :evaluation="evaluation"
            :mode="boardEvalBarMode"
            :direction="isVertical ? 'row' : 'column'"
            :reverse="!isVertical"
          />
        </div>
      </div>

      <div
        class="board relative-position all-pointer-events"
        @touchstart.stop
        @mousedown.stop
        @pointerdown="highlightStart"
        @pointermove="highlightMove"
      >
        <div class="squares absolute-fit column reverse-wrap">
          <Square v-for="coord in squares" :key="coord" :coord="coord" />
        </div>
        <div class="pieces absolute-fit no-pointer-events">
          <Piece
            v-for="(piece, id) in board.pieces"
            :key="id"
            :ref="id"
            :id="id"
          />
        </div>
        <AnalysisOverlay />
        <q-resize-observer class="absolute-fit" @resize="resizeSquare" />
      </div>

      <div
        v-if="$store.state.ui.axisLabels && !$store.state.ui.axisLabelsSmall"
        class="y-axis column reverse no-pointer-events"
      >
        <div v-for="y in yAxis" :key="y">
          {{ y }}
        </div>
      </div>

      <div
        v-if="$store.state.ui.axisLabels && !$store.state.ui.axisLabelsSmall"
        class="x-axis row items-end no-pointer-events"
        @click.right.prevent
      >
        <div v-for="x in xAxis" :key="x">{{ x }}</div>
      </div>

      <q-resize-observer class="absolute-fit" @resize="resizeBoard" />
    </div>
    <q-resize-observer @resize="resizeSpace" />
  </div>
</template>

<script>
import AnalysisOverlay from "./AnalysisOverlay";
import GameTimer from "./GameTimer";
import Piece from "./Piece";
import Square from "./Square";
import TurnIndicator from "./TurnIndicator";
import WdlBar from "../WdlBar";
import { HOTKEYS } from "../../keymap";
import { normalizeWDL } from "../../bots/wdl";
import {
  getActiveEvalDisplaySource,
  getEvalNumberOrder,
  getSelectedSuggestionForTps,
} from "../../utils/evalDisplaySource";

import { forEach, throttle } from "lodash";

const MAX_ANGLE = 30;
const ROTATE_SENSITIVITY = 3;
const BOARD_DEAD_SPACE_MD = 36;
const BOARD_DEAD_SPACE_SM = 28;
const BOARD_TOGGLES_WIDTH_MD = 208;
const BOARD_TOGGLES_WIDTH_SM = 160;
const BOARD_TOGGLES_HEIGHT_MD = 44;
const BOARD_TOGGLES_HEIGHT_SM = 34;

// 1em ≈ EMK * boardTrackWidth (derived from font-size formula)
// font-size = min(30px, squareSize * 0.21875 * boardSize / 5)
// squareSize ≈ boardTrackWidth / boardSize
// => font-size ≈ boardTrackWidth * 0.04375
const EMK = 0.04375;

export default {
  name: "Board",
  components: {
    AnalysisOverlay,
    GameTimer,
    Square,
    Piece,
    TurnIndicator,
    WdlBar,
  },
  props: {
    hideNames: Boolean,
  },
  data() {
    return {
      size: null,
      space: null,
      squareSize: null,
      scale: 1,
      x: 0,
      y: 0,
      deltaY: 0,
      highlighting: false,
      rotating: false,
      isSlowScrub: false,
      prevBoardRotation: null,
      boardRotation: this.$store.state.ui.boardRotation,
      zoomFitTimer: null,
      hotkeys: HOTKEYS.MOVES,
    };
  },
  computed: {
    board() {
      return this.$store.state.game.board;
    },
    squares() {
      return Object.keys(this.$store.state.game.board.squares).sort().reverse();
    },
    config() {
      return this.$store.state.game.config;
    },
    transform() {
      return this.$store.state.ui.boardTransform;
    },
    scrubbing() {
      return this.$store.state.ui.scrubbing;
    },
    scrollThreshold() {
      return this.$store.state.ui.scrollThreshold;
    },
    disableAnimations() {
      return (
        !this.$store.state.ui.animateBoard ||
        (!this.$store.state.ui.animateScrub &&
          this.scrubbing &&
          !this.isSlowScrub)
      );
    },
    disableHotkeys() {
      const $gameSelector =
        this.$parent.$parent.$parent.$parent.$refs.gameSelector;
      return (
        this.isDialogOpen ||
        this.isHighlighting ||
        this.isEditingTPS ||
        this.$store.state.ui.disableBoard ||
        ($gameSelector &&
          $gameSelector.$refs.select &&
          $gameSelector.$refs.select.menu)
      );
    },
    cols() {
      return "abcdefgh".substring(0, this.config.size).split("");
    },
    rows() {
      return "12345678".substring(0, this.config.size).split("");
    },
    yAxis() {
      let axis =
        this.transform[0] % 2 ? this.cols.concat() : this.rows.concat();
      if (this.transform[0] === 1 || this.transform[0] === 2) {
        axis.reverse();
      }
      return axis;
    },
    xAxis() {
      let axis =
        this.transform[0] % 2 ? this.rows.concat() : this.cols.concat();
      if (
        this.transform[1]
          ? this.transform[0] === 0 || this.transform[0] === 1
          : this.transform[0] === 2 || this.transform[0] === 3
      ) {
        axis.reverse();
      }
      return axis;
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    showEvaluation() {
      return this.$store.state.ui.showEval && this.$store.state.ui.boardEvalBar;
    },
    evaluation() {
      // First check for override from SET_EVAL (e.g., from live analysis)
      if (this.$store.state.game.evaluation !== null) {
        return this.$store.state.game.evaluation;
      }

      const tps = this.position.tps;

      return this.$store.getters["game/evaluationForTps"](tps);
    },
    boardEvalNumberOrder() {
      return getEvalNumberOrder(this.$store.state.analysis?.evalType);
    },
    boardEvalBarMode() {
      const analysis = this.$store.state.analysis;
      if (!analysis) {
        // Embed mode: the `analysis` Vuex module isn't registered. Match the
        // PTN analysis panel, which renders WDL-style bars whenever a WDL can
        // be derived (real or sigmoid-synthesized from the evaluation).
        return this.boardEvalWdl ? "wdl" : "single";
      }

      const tps = this.position.tps;
      const suggestion = getSelectedSuggestionForTps({
        analysis,
        tps,
        currentTps: this.$store.state.game.position.tps,
        getSuggestionsForTps: this.$store.getters["game/suggestions"],
      });
      const activeDisplaySource = getActiveEvalDisplaySource({
        analysisSource: analysis.analysisSource,
        suggestion,
        evaluation: this.evaluation,
        rawWdl: normalizeWDL(suggestion && suggestion.wdl, this.evaluation),
        evalNumberOrder: this.boardEvalNumberOrder,
      });

      return activeDisplaySource === "wdl" ? "wdl" : "single";
    },
    boardEvalWdl() {
      const evalOverride = this.$store.state.game.evaluation;
      const wdlOverride = this.$store.state.game.evaluationWDL;
      if (wdlOverride !== null || evalOverride !== null) {
        return normalizeWDL(wdlOverride, evalOverride);
      }

      const tps = this.position.tps;
      const wdlForTps = this.$store.getters["game/wdlForTps"];
      if (wdlForTps) {
        const wdl = wdlForTps(tps);
        if (wdl) {
          return wdl;
        }
      }
      return normalizeWDL(
        null,
        this.$store.getters["game/evaluationForTps"](tps)
      );
    },
    evaluationText() {
      const ply = this.position.boardPly
        ? this.$store.state.game.ptn.allPlies[this.position.boardPly.id]
        : null;
      if (!ply) return null;

      const plyEval = ply.evaluation;
      const takTinue = plyEval
        ? (plyEval.tinue ? '"' : "") + (plyEval.tak ? "'" : "")
        : "";

      const analysis = this.$store.state.analysis;
      const showEvalMarks = analysis?.showEvalMarks;

      // Check for dynamic eval mark override from bot analysis or saved results
      if (showEvalMarks) {
        const getOverride = this.$store.getters["analysis/getEvalMarkOverride"];
        const override = getOverride ? getOverride(ply) : null;
        if (override) {
          return override + takTinue;
        }
      }

      // Always show manual eval marks from PTN
      if (plyEval && (plyEval["?"] || plyEval["!"])) {
        return plyEval.text;
      }

      return takTinue || null;
    },
    selected() {
      return this.$store.state.game.selected;
    },
    style() {
      return this.$store.state.ui.theme.boardStyle;
    },
    moveNumber() {
      if (this.$store.state.game.editingTPS) {
        return this.$store.state.ui.firstMoveNumber;
      } else {
        return this.position.boardPly
          ? this.$store.state.game.ptn.allPlies[this.position.boardPly.id]
              .linenum.number
          : this.$store.state.game.position.move.linenum.number;
      }
    },
    showMoveNumber() {
      return this.$store.state.ui.moveNumber;
    },
    hasClockData() {
      return (
        this.$store.state.game.config?.gameTime1 !== undefined ||
        this.$store.state.game.config?.gameTime2 !== undefined
      );
    },
    // When the turn indicator is showing and flat counts are hidden, the
    // clocks are rendered inline inside the turn indicator instead of in
    // their own row above the board. The `gameTimer` UI flag hides the
    // clocks entirely.
    showGameTimer() {
      if (!this.hasClockData) return false;
      if (!this.$store.state.ui.gameTimer) return false;
      const inlineInTurnIndicator =
        this.$store.state.ui.turnIndicator && !this.$store.state.ui.flatCounts;
      return !inlineInTurnIndicator;
    },
    turn() {
      return this.$store.state.game.editingTPS !== undefined
        ? this.$store.state.ui.selectedPiece.color
        : this.position.turn;
    },
    boardPly() {
      return this.board.ply;
    },
    board3D() {
      return this.$store.state.ui.board3D;
    },
    orthographic() {
      return this.$store.state.ui.orthographic;
    },
    perspective() {
      const factor = 1 - this.$store.state.ui.perspective / 10;
      return this.$q.screen.height * Math.pow(3, factor) + "px";
    },
    // Static aspect ratio computed from grid structure and stable settings.
    // All proportional to the board track width (B), using EMK for em units.
    // This avoids any dependency on rendered size (this.size), breaking
    // feedback loops between width ↔ size ↔ ratio.
    staticRatio() {
      const S = this.config.size;
      const axisLabels =
        this.$store.state.ui.axisLabels &&
        !this.$store.state.ui.axisLabelsSmall;
      const showUnplayed = this.$store.state.ui.unplayedPieces;
      const showTurn = this.$store.state.ui.turnIndicator;
      const showMoveNum = this.showMoveNumber;
      const showTimer = this.showGameTimer;

      // Width components (in units of B)
      const yAxisW = axisLabels ? 1.5 * EMK : 0;
      const boardW = 1;
      const unplayedHW = showUnplayed && !this.isVertical ? 1.75 / S : 0;
      const totalW = yAxisW + boardW + unplayedHW;

      // Height components (in units of B)
      const timerH = showTimer ? 1.75 * EMK : 0;
      const turnH = showTurn ? 2.25 * EMK : 0;
      const moveNumH = showMoveNum ? 1.75 * EMK : 0;
      const axisH = axisLabels ? 1.5 * EMK : 0;

      let row1H, row2H;
      if (this.isVertical || !showUnplayed) {
        // Move-number in row 1 (col 2)
        row1H = Math.max(timerH, moveNumH);
        row2H = turnH;
      } else {
        // Horizontal with unplayed: move-number in row 2 (col 3)
        // Special case: timer moves to row 2 when !showTurn && showMoveNum
        const timerInRow2 = showTimer && showMoveNum && !showTurn;
        if (timerInRow2) {
          row1H = 0;
          row2H = Math.max(timerH, moveNumH, turnH);
        } else {
          row1H = timerH;
          row2H = Math.max(turnH, moveNumH);
        }
      }

      const boardH = 1;
      const unplayedVH = showUnplayed && this.isVertical ? 1 / S : 0;
      const totalH = row1H + row2H + boardH + unplayedVH + axisH;

      return totalW / totalH;
    },
    // Estimated board dimensions from space and staticRatio only.
    // Uses raw space (no topDeadSpace subtraction) to avoid circular deps.
    estimatedBoardWidth() {
      if (!this.space) return 0;
      const ratio = this.staticRatio;
      const spaceAspect = this.space.width / this.space.height;
      if (spaceAspect < ratio) {
        // Width-constrained
        return this.space.width;
      }
      // Height-constrained
      return this.space.height * ratio;
    },
    estimatedBoardHeight() {
      if (!this.space) return 0;
      return this.estimatedBoardWidth / this.staticRatio;
    },
    isPortrait() {
      return this.space && this.space.width - this.estimatedBoardWidth < 136;
    },
    isVertical() {
      return (
        this.$store.state.ui.verticalLayout &&
        (!this.$store.state.ui.verticalLayoutAuto ||
          (this.space && this.space.width < this.space.height))
      );
    },
    isSmallToggles() {
      if (
        this.$q.screen.height >= this.$q.screen.sizes.sm &&
        this.$q.screen.width >= this.$q.screen.sizes.sm
      ) {
        return false;
      }
      // Small screen — check if md toggles still fit
      if (!this.space) return true;
      const vGap = this.space.height - this.estimatedBoardHeight;
      const hGap = (this.space.width - this.estimatedBoardWidth) / 2;
      return vGap < BOARD_TOGGLES_HEIGHT_MD && hGap < BOARD_TOGGLES_WIDTH_MD;
    },
    topDeadSpace() {
      if (!this.space) {
        return this.isSmallToggles
          ? BOARD_TOGGLES_HEIGHT_SM
          : BOARD_TOGGLES_HEIGHT_MD;
      }
      const ratio = this.staticRatio;
      const spaceAspect = this.space.width / this.space.height;
      if (ratio >= spaceAspect) {
        // Width-constrained: board doesn't fill height, toggles fit above
        return 0;
      }
      // Height-constrained: if toggles fit beside the board, no top space
      if (this.toggleLayout === "column") return 0;
      // Row layout: reserve the actual toggle height
      return this.isSmallToggles
        ? BOARD_TOGGLES_HEIGHT_SM
        : BOARD_TOGGLES_HEIGHT_MD;
    },
    // Toggle button layout: column only when horizontal gap fits a button
    toggleLayout() {
      if (!this.space) return "row";
      const hGap = (this.space.width - this.estimatedBoardWidth) / 2;
      const toggleW = this.isSmallToggles
        ? BOARD_TOGGLES_HEIGHT_SM
        : BOARD_TOGGLES_HEIGHT_MD;
      if (hGap >= toggleW) return "column";
      return "row";
    },
    width() {
      if (this.space && this.size) {
        const spaceHeight = this.space.height - this.topDeadSpace;
        const spaceAspect = this.space.width / spaceHeight;
        const boardAspect = this.staticRatio;
        const widthBound = this.space.width;
        const heightBound = spaceHeight * boardAspect;
        let width;
        let padding;
        if (spaceAspect < boardAspect) {
          // Width-constrained
          width = widthBound;
          padding = Math.max(32, width * 0.1);
        } else {
          // Height-constrained
          width = heightBound;
          padding = Math.max(32 * boardAspect, width * 0.1);
        }
        return Math.max(width - padding, 10) + "px";
      } else {
        return "80%";
      }
    },
    CSS3DTransform() {
      const x = this.boardRotation[0];
      const y = this.boardRotation[1];
      const magnitude = Math.sqrt(x * x + y * y);
      const scale = this.scale;
      const translate = `${this.x}px, ${this.y}px`;

      const rotateZ = -x * y * MAX_ANGLE * 1.5 + "deg";

      const rotate3d = [y, x, 0, magnitude * MAX_ANGLE + "deg"].join(",");

      return this.board3D
        ? `translate(${translate}) scale(${scale}) rotateZ(${rotateZ}) rotate3d(${rotate3d})`
        : "";
    },
    isDialogOpen() {
      return !["local", "game"].includes(this.$route.name);
    },
    isHighlighting() {
      return this.$store.state.game.highlighterEnabled;
    },
    isEditingTPS() {
      return this.$store.state.game.editingTPS !== undefined;
    },
  },
  methods: {
    shortkey({ srcKey }) {
      if (srcKey === "cancelMove") {
        this.$store.dispatch("game/CANCEL_MOVE");
      } else {
        const count = srcKey.slice(10).toLowerCase();
        const square =
          this.$store.state.game.selected.moveset.length > 1
            ? this.$store.getters["ui/nextNeighbor"]()
            : this.$store.state.game.hoveredSquare;
        if (square !== null) {
          this.$store.dispatch("game/SELECT_DROP_PIECES", { square, count });
        }
      }
    },
    highlightStart(event) {
      if (!event || !event.target || !event.target.dataset.coord) {
        return;
      }
      if (event.target.hasPointerCapture(event.pointerId)) {
        event.target.releasePointerCapture(event.pointerId);
      }
      if (event.pointerType === "touch") {
        const coord = event.target.dataset.coord;
        const color =
          this.$store.state.ui.highlighterColor ||
          this.$store.state.ui.theme.colors.primary;
        const squares = { ...this.$store.state.game.highlighterSquares };
        this.highlighting =
          !(coord in squares) || squares[coord] !== color ? 1 : 2;
      } else {
        this.highlighting = event.which;
      }
      window.addEventListener("pointerup", this.highlightEnd);
      this.highlightMove(event);
    },
    highlightMove(event) {
      if (
        !event ||
        !event.target ||
        !event.target.dataset.coord ||
        !this.highlighting
      ) {
        return;
      }
      const coord = event.target.dataset.coord;
      const color =
        this.$store.state.ui.highlighterColor ||
        this.$store.state.ui.theme.colors.primary;
      const squares = { ...this.$store.state.game.highlighterSquares };
      if (
        this.highlighting === 1 &&
        (!(coord in squares) || squares[coord] !== color)
      ) {
        squares[coord] = color;
        this.$store.dispatch("game/SET_HIGHLIGHTER_SQUARES", squares);
      } else if (this.highlighting > 1 && coord in squares) {
        delete squares[coord];
        this.$store.dispatch("game/SET_HIGHLIGHTER_SQUARES", squares);
      }
    },
    highlightEnd(event) {
      this.highlighting = false;
      window.removeEventListener("pointerup", this.highlightEnd);
    },
    dropPiece() {
      if (this.selected.pieces.length === 1) {
        this.$store.dispatch("game/SELECT_PIECE", {
          type: this.selected.pieces[0].type,
        });
      }
    },
    resizeSquare(size) {
      // Prevent jitter at some dimensions
      if (Math.abs(size.width - this.squareSize) > 1) {
        this.squareSize = size.width;
      }
    },
    resizeBoard(size) {
      this.size = size;
      this.$store.commit("ui/SET_UI", ["boardSize", size]);
      if (this.$store.state.ui.isVertical !== this.isVertical) {
        this.$store.commit("ui/SET_UI", ["isVertical", this.isVertical]);
      }
    },
    resizeSpace(size) {
      this.space = size;
      this.$store.commit("ui/SET_UI", ["boardSpace", size]);
    },
    resetBoardRotation() {
      if (this.board3D) {
        this.boardRotation = this.$store.state.ui.defaults.boardRotation;
        this.$store.dispatch("ui/SET_UI", [
          "boardRotation",
          this.boardRotation,
        ]);
        this.zoomFitAfterTransition();
      }
    },
    rotateBoard(event) {
      if (!this.board3D) {
        return;
      }

      if (event.isFirst) {
        this.rotating = true;
        this.prevBoardRotation = { ...this.boardRotation };
      }
      if (event.isFinal) {
        this.rotating = false;
      }

      let x =
        this.prevBoardRotation[0] +
        (ROTATE_SENSITIVITY * event.offset.x) / this.size.width;
      if (x > 1) {
        x = 1 + (x - 1) / 3;
      } else if (x < -1) {
        x = -1 + (x + 1) / 3;
      }

      let y =
        this.prevBoardRotation[1] -
        (ROTATE_SENSITIVITY * event.offset.y) / this.size.width;
      if (y > 1) {
        y = 1 + (y - 1) / 3;
      } else if (y < 0) {
        y /= 3;
      }

      if (event.delta.x < 2 && Math.abs(x) < 0.05) {
        x = 0;
      }

      this.boardRotation = [x, y];
      if (event.isFinal) {
        this.$nextTick(() => {
          this.boardRotation = [
            Math.max(-1, Math.min(1, x)),
            Math.max(0, Math.min(1, y)),
          ];
          this.$store.dispatch("ui/SET_UI", [
            "boardRotation",
            this.boardRotation,
          ]);
          this.zoomFitAfterTransition();
        });
      }
    },
    scroll(event) {
      if (this.$store.state.ui.embed) {
        return;
      }

      if (this.$store.state.ui.scrollNavigation) {
        // Get threshold from screen resolution if not specified
        const scrollThreshold =
          this.scrollThreshold || window.devicePixelRatio * 100;

        // Start scrubbing
        if (!this.$store.state.ui.scrubbing) {
          this.$store.commit("ui/SET_SCRUBBING", "start");
        }

        // Scroll by half-ply and re-enable animations
        this.isSlowScrub = event.shiftKey;

        // Handle smooth scrolling
        this.deltaY += event.deltaY;
        if (Math.abs(this.deltaY) >= scrollThreshold) {
          const action = this.deltaY < 0 ? "game/PREV" : "game/NEXT";
          let times = Math.floor(Math.abs(this.deltaY) / scrollThreshold);
          this.deltaY = (this.deltaY + event.deltaY) % scrollThreshold;
          if (times) {
            this.$store.dispatch(action, { half: this.isSlowScrub, times });
          }
        }

        clearTimeout(this.scrollTimer);
        this.scrollTimer = setTimeout(() => {
          // End scrubbing
          this.$store.commit("ui/SET_SCRUBBING", "end");
          this.isSlowScrub = false;
          this.deltaY = 0;
        }, 300);
      }
    },
    getBounds(nodes) {
      if (nodes.length === 1) {
        return nodes[0].getBoundingClientRect();
      } else {
        let bbAll = {
          top: Infinity,
          bottom: -Infinity,
          left: Infinity,
          right: -Infinity,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
        };
        nodes.forEach((node) => {
          const bb = node.getBoundingClientRect();
          bbAll.top = Math.min(bbAll.top, bb.top);
          bbAll.bottom = Math.max(bbAll.bottom, bb.bottom);
          bbAll.left = Math.min(bbAll.left, bb.left);
          bbAll.right = Math.max(bbAll.right, bb.right);
        });
        bbAll.width = bbAll.right - bbAll.left;
        bbAll.height = bbAll.bottom - bbAll.top;
        bbAll.x = bbAll.left;
        bbAll.y = bbAll.top;
        return bbAll;
      }
    },
    zoomFit() {
      let nodes = [this.$refs.container];
      if (this.$store.state.ui.unplayedPieces) {
        forEach(this.board.pieces, (piece, id) => {
          if (!piece.square) {
            nodes.push(this.$refs[id][0].$refs.stone);
          }
        });
      }
      forEach(this.board.squares, (square) => {
        if (square.piece) {
          nodes.push(this.$refs[square.piece][0].$refs.stone);
        }
      });
      const boardBB = this.getBounds(nodes);
      const spaceBB = this.$refs.wrapper.getBoundingClientRect();

      const padding = Math.min(this.space.width, this.space.height) * 0.1;
      const halfPad = padding / 2;
      spaceBB.width -= padding;
      spaceBB.height -= padding;
      spaceBB.x += halfPad;
      spaceBB.y += halfPad;

      let scale;
      if (boardBB.width / spaceBB.width > boardBB.height / spaceBB.height) {
        // Horizontally bound
        scale = spaceBB.width / boardBB.width;
      } else {
        // Vertically bound
        scale = spaceBB.height / boardBB.height;
      }
      this.x =
        (this.x + spaceBB.x - boardBB.x) * scale +
        ((spaceBB.width - boardBB.width) / 2) * scale;
      this.y =
        (this.y + spaceBB.y - boardBB.y) * scale +
        ((spaceBB.height - boardBB.height) / 2) * scale;
      scale *= this.scale;
      this.scale = scale;
    },
    zoomFitNextTick() {
      if (this.board3D) {
        this.$nextTick(this.zoomFit);
      }
    },
    zoomFitAfterDelay() {
      if (this.board3D) {
        if (this.zoomFitTimer) {
          clearTimeout(this.zoomFitTimer);
        }
        this.zoomFitTimer = setTimeout(() => {
          this.zoomFitNextTick();
          this.zoomFitTimer = null;
        }, 300);
      }
    },
    zoomFitAfterTransition() {
      if (this.board3D) {
        if (this.$store.state.ui.animateBoard) {
          if (this.zoomFitTimer) {
            clearTimeout(this.zoomFitTimer);
          }
          this.zoomFitTimer = setTimeout(() => {
            if (this.$refs.container) {
              this.$refs.container.ontransitionend = () => {
                this.zoomFitNextTick();
                this.$refs.container.ontransitionend = null;
              };
            }
            this.zoomFitTimer = null;
          }, 300);
        } else {
          this.zoomFitNextTick();
        }
      }
    },
  },
  created() {
    this.zoomFit = throttle(this.zoomFit, 10);
  },
  watch: {
    isPortrait(isPortrait) {
      if (isPortrait !== this.$store.state.ui.isPortrait) {
        this.$store.commit("ui/SET_UI", ["isPortrait", isPortrait]);
      }
    },
    isVertical(isVertical) {
      if (isVertical !== this.$store.state.ui.isVertical) {
        this.$store.commit("ui/SET_UI", ["isVertical", isVertical]);
      }
    },
    isSmallToggles(val) {
      if (val !== this.$store.state.ui.isSmallToggles) {
        this.$store.commit("ui/SET_UI", ["isSmallToggles", val]);
      }
    },
    toggleLayout(val) {
      if (val !== this.$store.state.ui.toggleLayout) {
        this.$store.commit("ui/SET_UI", ["toggleLayout", val]);
      }
    },
    boardPly: "zoomFitAfterTransition",
    size: "zoomFitAfterDelay",
    boardRotation: "zoomFitNextTick",
    transform: "zoomFitAfterDelay",
    board3D: "zoomFitAfterTransition",
    orthographic: "zoomFitNextTick",
  },
};
</script>

<style lang="scss">
$axis-size: 1.5em;
$radius: 0.35em;

.board-space {
  display: flex;
  flex-direction: column;
  align-items: center;

  &:not(.board-3D),
  &.orthographic {
    perspective: none !important;
  }
  &.board-3D {
    perspective-origin: center;
    .board-container {
      transform-style: preserve-3d;
    }
    .board,
    .board-row,
    .squares {
      transform-style: preserve-3d;
    }
  }
}

.board-container {
  font-size: min(
    30px,
    calc(var(--square-size) * 0.21875 * var(--board-size) / 5)
  );
  position: relative;
  z-index: 0;
  transition: transform $generic-hover-transition,
    width $generic-hover-transition;
  text-align: center;

  display: grid;
  gap: 0;
  grid-template-columns: auto var(--board-size-grid) auto;
  grid-template-rows: auto auto var(--board-size-grid) auto auto;
  &.show-unplayed-pieces.horizontal {
    grid-template-columns: auto var(--board-size-grid) 1.75fr;
  }
  &.show-unplayed-pieces.vertical {
    grid-template-rows: auto auto var(--board-size-grid) 1fr auto;
  }

  &.rotating {
    transition: none !important;
  }
  &.scrubbing,
  &.no-animations {
    &,
    .piece,
    .stone,
    .turn-indicator .player1,
    .turn-indicator .player2,
    .turn-indicator .komi,
    .evaluation,
    .evaluation .segment,
    .square .hl,
    .square .numbers span,
    .square .road > div {
      transition: none !important;
    }
  }

  &.rotate-1 .squares {
    transform: rotateZ(90deg);
  }
  &.rotate-2 .squares {
    transform: rotateZ(180deg);
  }
  &.rotate-3 .squares {
    transform: rotateZ(270deg);
  }
  &.flip .squares {
    transform: scaleX(-1);
  }
  &.flip.rotate-1 .squares {
    transform: scaleX(-1) rotateZ(90deg);
  }
  &.flip.rotate-2 .squares {
    transform: scaleX(-1) rotateZ(180deg);
  }
  &.flip.rotate-3 .squares {
    transform: scaleX(-1) rotateZ(270deg);
  }
}

.move-number-container {
  position: relative;
  height: 1.75em;
  grid-column-start: 3;
  grid-row-start: 2;
  .board-container.vertical &,
  .board-container:not(.show-unplayed-pieces) & {
    grid-column-start: 2;
    grid-row-start: 1;
  }

  &.playtak-live {
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .move-number,
  .eval-text {
    height: 1.75em;
    line-height: 1.75;
  }

  .eval-text {
    font-weight: bold;
    color: var(--q-color-primary);
  }
}

.turn-indicator {
  grid-column-start: 2;
  grid-row-start: 2;
}

.x-axis,
.y-axis,
.move-number {
  color: var(--q-color-textDark);
  text-shadow: 0 0.05em 0.1em var(--q-color-textLight);
  justify-content: space-around;
  line-height: 1em;
  body.secondaryDark & {
    color: var(--q-color-textLight);
    text-shadow: 0 0.05em 0.1em var(--q-color-textDark);
  }
}
.x-axis {
  z-index: 1;
  grid-column-start: 2;
  grid-row-start: 5;
  align-items: flex-end;
  height: $axis-size;
}

.y-axis {
  grid-column-start: 1;
  grid-row-start: 3;
  align-items: flex-start;
  width: $axis-size;
}

.board {
  grid-column-start: 2;
  grid-row-start: 3;
  grid-row-start: 3;
  background: var(--q-color-board1);
  z-index: 1;
  width: 100%;
  aspect-ratio: 1;

  .square,
  .piece {
    aspect-ratio: 1;
    width: calc(100% / var(--board-size));
    font-size: var(--square-size);
  }
  .pieces {
    transform-style: preserve-3d;
    z-index: 1;
  }
}

.unplayed-bg,
.move-number {
  will-change: width;
  pointer-events: all;
  .board-container:not(.show-unplayed-pieces) & {
    width: 0 !important;
    height: 0 !important;
  }
}

.unplayed-bg {
  background-color: var(--q-color-board3);
  overflow: hidden;
  position: relative;

  .evaluation {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  &.horizontal {
    grid-column-start: 3;
    grid-row-start: 3;
    border-radius: 0 $radius $radius 0;
    .evaluation {
      .segment {
        width: 100%;
        will-change: height, background-color;
      }
    }
  }

  &.vertical {
    grid-column-start: 2;
    grid-row-start: 4;
    border-radius: 0 0 $radius $radius;
    .evaluation {
      .segment {
        height: 100%;
        will-change: width, background-color;
      }
    }
  }
}
</style>
