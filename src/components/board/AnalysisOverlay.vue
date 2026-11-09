<template>
  <div
    v-if="active && vizLayers.length"
    class="analysis-overlay-wrap"
    :class="{ 'analysis-overlay-wrap-3d': board3D }"
  >
    <svg
      v-for="(layer, li) in vizLayers"
      :key="li"
      class="analysis-overlay no-pointer-events"
      :viewBox="`0 0 ${boardSize} ${boardSize}`"
      :style="layer.style"
    >
      <template v-for="(el, i) in layer.elements">
        <rect
          v-if="el.shape === 'flat'"
          :key="'v' + i"
          :x="el.x"
          :y="el.y"
          :width="el.w"
          :height="el.h"
          :rx="el.rx"
          :class="el.classes"
          :opacity="el.opacity"
          :stroke-width="el.strokeWidth"
        />
        <circle
          v-if="el.shape === 'cap'"
          :key="'v' + i"
          :cx="el.cx"
          :cy="el.cy"
          :r="el.r"
          :class="el.classes"
          :opacity="el.opacity"
          :stroke-width="el.strokeWidth"
        />
        <rect
          v-if="el.shape === 'wall'"
          :key="'v' + i"
          :x="el.x"
          :y="el.y"
          :width="el.w"
          :height="el.h"
          :rx="el.rx"
          :class="el.classes"
          :transform="el.transform"
          :opacity="el.opacity"
          :stroke-width="el.strokeWidth"
        />
        <g v-if="el.shape === 'arrow'" :key="'v' + i" :opacity="el.opacity">
          <line
            :x1="el.x1"
            :y1="el.y1"
            :x2="el.x2"
            :y2="el.y2"
            :class="el.borderClass"
            :stroke-width="el.borderStrokeWidth"
            stroke-linecap="round"
          />
          <polygon
            :points="el.headPoints"
            :class="[el.headClass, el.headBorderClass]"
            :stroke-width="el.headBorderWidth"
          />
          <g v-for="(drop, di) in el.drops" :key="'d' + di">
            <polygon
              v-if="drop.isPickup"
              :points="drop.bgPoints"
              :class="[el.headClass, el.headBorderClass]"
              :stroke-width="el.headBorderWidth"
            />
            <circle
              v-if="!drop.inHead && !drop.isPickup"
              :cx="drop.cx"
              :cy="drop.cy"
              :r="drop.r"
              :class="[el.headClass, el.headBorderClass]"
              :stroke-width="el.headBorderWidth"
            />
          </g>
          <line
            :x1="el.x1"
            :y1="el.y1"
            :x2="el.x2"
            :y2="el.y2"
            :class="el.classes"
            :stroke-width="el.strokeWidth"
            stroke-linecap="round"
          />
          <g v-for="(drop, di) in el.drops" :key="'t' + di">
            <text
              v-if="drop.count !== null"
              :x="drop.cx"
              :y="drop.cy"
              :font-size="drop.fontSize"
              :class="['drop-count', el.textClass]"
              text-anchor="middle"
              :dominant-baseline="dropCountDominantBaseline"
              :alignment-baseline="dropCountAlignmentBaseline"
            >
              {{ drop.count }}
            </text>
          </g>
        </g>
      </template>
    </svg>
  </div>
</template>

<script>
import { transformCoord } from "src/utils/boardTransform";
import {
  ARROW_STROKE_WIDTH,
  arrow3DStyle,
  arrowGeometry,
  groupOverlappingArrows,
  stackTopOffset,
} from "src/utils/arrowGeometry";
import { parseAnalyzedSuggestions } from "../../utilities";
import { bots } from "../../bots";

export default {
  name: "AnalysisOverlay",
  computed: {
    active() {
      // Drawn annotations and analysis visuals are never shown together
      return (
        this.$store.state.ui.showAnalysisBoard &&
        !this.$store.getters["game/annotationsActive"]
      );
    },
    board3D() {
      return this.$store.state.ui.board3D;
    },
    boardSquares() {
      return this.$store.state.game.board.squares;
    },
    boardPieces() {
      return this.$store.state.game.board.pieces;
    },
    boardSize() {
      return this.$store.state.game.config.size;
    },
    analysisState() {
      return this.$store.state.analysis || {};
    },
    analysisSource() {
      if (this.$store.state.ui.embed) return "embed";
      return this.analysisState.analysisSource || "openings";
    },
    tps() {
      return this.$store.state.game.position.tps;
    },
    turn() {
      return this.$store.state.game.position.turn;
    },
    transform() {
      return this.$store.state.ui.boardTransform;
    },
    hoveredOverlayPlyText() {
      return this.analysisState.hoveredOverlayPlyText || null;
    },
    isFirefox() {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent || "";
      return /firefox/i.test(ua) && !/seamonkey/i.test(ua);
    },
    dropCountDominantBaseline() {
      return this.isFirefox ? "central" : "middle";
    },
    dropCountAlignmentBaseline() {
      return this.isFirefox ? null : "middle";
    },
    pieceBorderWidth() {
      const theme = this.$store.state.ui.theme;
      const v = theme && theme.vars && theme.vars["piece-border-width"];
      return (v != null ? Number(v) : 1) * 0.013 * 0.5;
    },
    rawMoves() {
      if (!this.active) return [];

      // In embed mode the `analysis` Vuex module isn't registered; fall back to
      // positions pushed by the host via SET_ANALYSIS (or inline PTN eval).
      if (!this.$store.state.analysis) {
        const ap = this.$store.state.game.analyzedPositions[this.tps];
        if (ap && ap.suggestions && ap.suggestions.length) {
          const color = this.$store.state.game.position.color;
          return parseAnalyzedSuggestions(ap.suggestions, this.turn, color);
        }
        return this.$store.getters["game/suggestions"](this.tps) || [];
      }

      switch (this.analysisSource) {
        case "openings":
          return this.analysisState.currentOpeningMoves || [];
        case "engines": {
          const analysis = this.analysisState;
          const botID = analysis.botID;
          if (!botID) return [];
          const positions = analysis.botPositions?.[botID];
          return positions ? positions[this.tps] || [] : [];
        }
        case "saved": {
          const analysis = this.analysisState;
          const allSuggestions = this.$store.getters["game/suggestions"](
            this.tps
          );
          const savedBotName = analysis.savedBotName;
          const activeBots = analysis.activeBots || [];
          let resolvedBotID = analysis.botID;
          if (savedBotName) {
            for (const id of activeBots) {
              const bot = bots[id];
              if (bot && bot.label === savedBotName) {
                resolvedBotID = id;
                break;
              }
            }
          }

          const livePositions = resolvedBotID
            ? analysis.botPositions?.[resolvedBotID]
            : null;
          const liveSuggestions = livePositions
            ? livePositions[this.tps] || []
            : [];

          const botState = resolvedBotID
            ? analysis.botStates?.[resolvedBotID]
            : null;
          const showLiveSuggestions = !!(
            botState &&
            botState.isRunning &&
            botState.tps === this.tps
          );

          if (showLiveSuggestions) {
            return liveSuggestions;
          }

          if (!allSuggestions || allSuggestions.length === 0) {
            return liveSuggestions;
          }

          const savedSuggestions =
            savedBotName === null
              ? allSuggestions.filter((s) => !s.botName)
              : allSuggestions.filter((s) => s.botName === savedBotName);

          return savedSuggestions.length > 0
            ? savedSuggestions
            : liveSuggestions;
        }
        default:
          return [];
      }
    },
    moves() {
      const validMoves = this.rawMoves.filter((m) => m && m.ply);
      if (validMoves.length === 0) return [];

      // Deduplicate by ply text, keeping the superior result
      const seen = {};
      const deduped = [];
      for (const m of validMoves) {
        const key = m.ply.text;
        if (key in seen) {
          const existing = deduped[seen[key]];
          if (this.isSuperior(m, existing)) {
            deduped[seen[key]] = m;
          }
        } else {
          seen[key] = deduped.length;
          deduped.push(m);
        }
      }

      const strengths = this.computeStrengths(deduped);
      const scales = this.computeScales(deduped);

      return deduped.map((m, i) => ({
        ply: m.ply,
        strength: strengths[i],
        scale: scales[i],
        isPlacement: !m.ply.movement,
        isMovement: !!m.ply.movement,
        stoneType: this.getStoneType(m.ply),
        color: m.ply.color,
      }));
    },
    vizLayers() {
      if (this.moves.length === 0) return [];

      const layers = [];

      const placements = this.moves.filter((m) => m.isPlacement);
      const movements = this.moves.filter((m) => m.isMovement);

      // Placement layer (no Z offset needed)
      if (placements.length > 0) {
        const elements = [];
        const placementGroups = {};
        placements.forEach((m) => {
          const coord = m.ply.column + m.ply.row;
          if (!placementGroups[coord]) placementGroups[coord] = [];
          placementGroups[coord].push(m);
        });

        for (const coord in placementGroups) {
          const group = placementGroups[coord];
          const center = this.coordToSvg(coord);
          const offsets = this.getGroupOffsets(group.length);
          const scale = 0.75;

          group.forEach((m, i) => {
            elements.push(
              this.createStoneElement(m, center, offsets[i], scale)
            );
          });
        }
        layers.push({ elements, style: {} });
      }

      // Group arrows that share any edge in the same direction
      const arrowGroupMap = groupOverlappingArrows(
        movements,
        (m) => m.ply.squares,
        (m) => m.ply.direction === ">" || m.ply.direction === "<"
      );

      const hoveredPlyText = this.hoveredOverlayPlyText;
      const orderedMovements = hoveredPlyText
        ? [
            ...movements.filter((m) => m.ply.text !== hoveredPlyText),
            ...movements.filter((m) => m.ply.text === hoveredPlyText),
          ]
        : movements;

      orderedMovements.forEach((m) => {
        const groupInfo = arrowGroupMap.get(m);
        const index = groupInfo ? groupInfo.index : 0;
        const groupSize = groupInfo ? groupInfo.groupSize : 1;
        const el = this.createArrowElement(m, index, groupSize);
        if (!el) return;

        let style = {};
        if (this.board3D && m.ply.squares) {
          style = arrow3DStyle(m.ply.squares, this.boardSquares);
        }
        if (hoveredPlyText && m.ply.text === hoveredPlyText) {
          style = {
            ...style,
            zIndex: 1,
          };
        }
        layers.push({ elements: [el], style });
      });

      return layers;
    },
  },
  methods: {
    isSuperior(candidate, existing) {
      const cNodes = candidate.nodes != null ? candidate.nodes : null;
      const eNodes = existing.nodes != null ? existing.nodes : null;
      const cDepth = candidate.depth != null ? candidate.depth : null;
      const eDepth = existing.depth != null ? existing.depth : null;

      // If we can compare by nodes or depth, use that
      if (cNodes !== null && eNodes !== null && cNodes !== eNodes) {
        return cNodes > eNodes;
      }
      if (cDepth !== null && eDepth !== null && cDepth !== eDepth) {
        return cDepth > eDepth;
      }

      // Fall back to higher absolute eval
      const cEval =
        candidate.evaluation != null ? Math.abs(candidate.evaluation) : null;
      const eEval =
        existing.evaluation != null ? Math.abs(existing.evaluation) : null;
      if (cEval !== null && eEval !== null) {
        return cEval > eEval;
      }
      return false;
    },

    coordToSvg(coord) {
      const s = this.boardSize;

      const { x, y } = transformCoord(coord, s, this.transform);

      return { x: x + 0.5, y: s - 0.5 - y };
    },

    getStoneType(ply) {
      if (ply.specialPiece === "C") return "cap";
      if (ply.specialPiece === "S") return "wall";
      return "flat";
    },

    computeSubjectiveEvals(moves) {
      const isOpenings = this.analysisSource === "openings";
      return moves.map((m) => {
        if (isOpenings) {
          if (!m.totalGames || m.totalGames === 0) return 100;
          const wins = this.turn === 1 ? m.wins1 : m.wins2;
          const draws = m.draws || 0;
          return ((wins + draws * 0.5) / m.totalGames) * 200;
        }
        if (m.evaluation === null || m.evaluation === undefined) return null;
        return this.turn === 1 ? 100 + m.evaluation : 100 - m.evaluation;
      });
    },

    computeStrengths(moves) {
      const DEFAULT_OPACITY = 1.0;
      const MIN_OPACITY = 0.2;

      if (moves.length === 0) return [];
      if (moves.length === 1) return [DEFAULT_OPACITY];

      // For openings, opacity is based on commonality (totalGames) of each
      // move relative to the previous one, with a bounded step-down.
      if (this.analysisSource === "openings") {
        const MAX_OPACITY_DIFF = 0.15;
        const opacities = [];
        let prevOpacity = DEFAULT_OPACITY;
        let prevCommonality = null;
        for (let i = 0; i < moves.length; i++) {
          const commonality = Number(moves[i].totalGames) || 0;
          if (i === 0) {
            opacities.push(DEFAULT_OPACITY);
            prevCommonality = commonality;
            continue;
          }
          let opacity;
          if (!prevCommonality) {
            opacity = MIN_OPACITY;
          } else {
            const rel = commonality / prevCommonality;
            opacity = Math.max(
              prevOpacity * rel,
              prevOpacity - MAX_OPACITY_DIFF
            );
          }
          opacity = Math.min(DEFAULT_OPACITY, Math.max(MIN_OPACITY, opacity));
          opacities.push(opacity);
          prevOpacity = opacity;
          prevCommonality = commonality;
        }
        return opacities;
      }

      // For engines, opacity is an exponential of the subjective eval
      // relative to the best move: 0.2 + 0.8 * e^(K * (x - B) / B).
      // Each move depends only on itself and the best move, so adding
      // or removing the weakest move does not shift other moves.
      const K = 4;
      const subjEvals = this.computeSubjectiveEvals(moves);
      const B = subjEvals[0];
      if (B === null || B === 0) {
        return moves.map(() => DEFAULT_OPACITY);
      }
      return subjEvals.map((x, i) => {
        if (i === 0) return DEFAULT_OPACITY;
        if (x === null) return MIN_OPACITY;
        const opacity = MIN_OPACITY + 0.8 * Math.exp((K * (x - B)) / B);
        return Math.min(DEFAULT_OPACITY, Math.max(MIN_OPACITY, opacity));
      });
    },

    computeScales(moves) {
      const MIN_SCALE = 0.5;
      const MAX_SCALE = 1.0;
      const K = 5;

      if (moves.length === 0) return [];
      if (moves.length === 1) return [MAX_SCALE];

      // For openings, size derives from opacity via strengthScale.
      // Returning null lets the element renderers fall back to that.
      if (this.analysisSource === "openings") {
        return moves.map(() => null);
      }

      // For engines, scale uses the same exponential shape as opacity but
      // with its own K and floor: MIN_SCALE + (1 - MIN_SCALE) * e^(K*(x-B)/B).
      const subjEvals = this.computeSubjectiveEvals(moves);
      const B = subjEvals[0];
      if (B === null || B === 0) {
        return moves.map(() => MAX_SCALE);
      }
      return subjEvals.map((x, i) => {
        if (i === 0) return MAX_SCALE;
        if (x === null) return MIN_SCALE;
        const scale =
          MIN_SCALE + (MAX_SCALE - MIN_SCALE) * Math.exp((K * (x - B)) / B);
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
      });
    },

    getGroupOffsets(count) {
      if (count === 1) return [{ dx: 0, dy: 0 }];

      const perRow = 2;
      const spacing = 0.34;
      const offsets = [];
      const rows = Math.ceil(count / perRow);
      const totalHeight = (rows - 1) * spacing;

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / perRow);
        const itemsInRow = Math.min(perRow, count - row * perRow);
        const col = i % perRow;
        const rowWidth = (itemsInRow - 1) * spacing;
        const dx = -rowWidth / 2 + col * spacing;
        const dy = -totalHeight / 2 + row * spacing;
        offsets.push({ dx, dy });
      }
      return offsets;
    },

    strengthScale(strength) {
      const minOpacity = 0.2;
      const maxOpacity = 1.0;
      const minScale = 0.55;
      const maxScale = 1.0;
      const clamped = Math.min(maxOpacity, Math.max(minOpacity, strength));
      const t = (clamped - minOpacity) / (maxOpacity - minOpacity);
      const eased = t * t;
      return minScale + (maxScale - minScale) * eased;
    },

    createStoneElement(move, center, offset, scale) {
      const cx = center.x + offset.dx;
      const cy = center.y + offset.dy;
      const p = move.color;
      const strengthScale =
        move.scale === null || move.scale === undefined
          ? this.strengthScale(move.strength)
          : move.scale;
      const visualScale = scale * strengthScale;

      const sw = this.pieceBorderWidth;

      if (move.stoneType === "cap") {
        const r = 0.17 * visualScale;
        return {
          shape: "cap",
          cx,
          cy,
          r,
          classes: "special-p" + p,
          opacity: move.strength,
          strokeWidth: sw,
        };
      } else if (move.stoneType === "wall") {
        const w = 0.1 * visualScale;
        const h = 0.35 * visualScale;
        return {
          shape: "wall",
          x: cx - w / 2,
          y: cy - h / 2,
          w,
          h,
          rx: w * 0.15,
          classes: "special-p" + p,
          transform: `rotate(${p === 1 ? -45 : 45}, ${cx}, ${cy})`,
          opacity: move.strength,
          strokeWidth: sw,
        };
      } else {
        const sz = 0.35 * visualScale;
        return {
          shape: "flat",
          x: cx - sz / 2,
          y: cy - sz / 2,
          w: sz,
          h: sz,
          rx: sz * 0.12,
          classes: "stone-p" + p,
          opacity: move.strength,
          strokeWidth: sw,
        };
      }
    },

    createArrowElement(move, indexInGroup, groupSize) {
      const ply = move.ply;
      const squares = ply.squares;
      if (!squares || squares.length < 2) return null;
      const strengthScale =
        move.scale === null || move.scale === undefined
          ? this.strengthScale(move.strength)
          : move.scale;

      const from = this.coordToSvg(squares[0]);
      const to = this.coordToSvg(squares[squares.length - 1]);
      const p = move.color;

      const stackOffset = (coord) =>
        this.board3D
          ? 0
          : stackTopOffset(
              this.boardSquares[coord],
              this.boardPieces,
              this.boardSize
            );
      const geometry = arrowGeometry({
        from,
        to,
        fromStack: stackOffset(squares[0]),
        toStack: stackOffset(squares[squares.length - 1]),
        indexInGroup,
        groupSize,
      });
      if (!geometry) return null;
      const {
        ndx,
        ndy,
        px,
        py,
        ox,
        oy,
        sourceAdvance,
        baseX,
        baseY,
        tipX: finalTipX,
        tipY: finalTipY,
      } = geometry;

      const borderWidth = this.pieceBorderWidth;
      const strokeWidth = ARROW_STROKE_WIDTH * strengthScale;
      const borderStrokeWidth = strokeWidth + borderWidth * 2;
      const pickup = parseInt(ply.pieceCount, 10) || 1;

      // Compute drop count indicators
      const drops = [];
      const dist = ply.distribution;
      const isWholeStack = dist && dist.length === 1;
      const r = 0.08;
      const fontSize = 0.1;

      if (dist && squares.length > 1) {
        // Check if we should show pickup count
        const sourceCoord = squares[0];
        const sourceSq = this.boardSquares[sourceCoord];
        const sourceHeight =
          sourceSq && sourceSq.pieces ? sourceSq.pieces.length : 0;
        const showPickup = pickup > 1 || sourceHeight > 1;

        // Pickup arrowhead background (always shown)
        // Shift center forward so it doesn't overlap the stack
        const pCx = from.x + ox + ndx * (sourceAdvance + 0.03);
        const pCy = from.y + oy + ndy * (sourceAdvance + 0.03);
        const pLen = 0.2;
        const pHalf = 0.1;
        const pTipX = pCx + ndx * pLen * 0.6;
        const pTipY = pCy + ndy * pLen * 0.6;
        const pBackX = pCx - ndx * pLen * 0.4;
        const pBackY = pCy - ndy * pLen * 0.4;
        const plx = pBackX + px * pHalf;
        const ply2 = pBackY + py * pHalf;
        const prx = pBackX - px * pHalf;
        const pry = pBackY - py * pHalf;
        // Text position closer to base (1/3 from base)
        const tCx = pBackX + (pTipX - pBackX) * 0.3;
        const tCy = pBackY + (pTipY - pBackY) * 0.3;
        drops.push({
          cx: tCx,
          cy: tCy,
          r,
          fontSize,
          count: showPickup ? pickup : null,
          isPickup: true,
          bgPoints: `${pTipX},${pTipY} ${plx},${ply2} ${prx},${pry}`,
        });

        if (!isWholeStack) {
          // Intermediate drop counts (not the last one)
          for (let si = 1; si < squares.length - 1; si++) {
            const count = parseInt(dist[si - 1], 10);
            if (isNaN(count)) continue;
            const sq = this.coordToSvg(squares[si]);
            const sqToX1x = sq.x - (from.x + ox);
            const sqToX1y = sq.y - (from.y + oy);
            const proj = sqToX1x * ndx + sqToX1y * ndy;
            const cx = from.x + ox + ndx * proj;
            const cy = from.y + oy + ndy * proj;
            drops.push({ cx, cy, r, fontSize, count });
          }
          // Final drop count inside arrowhead (no circle)
          const lastCount = parseInt(dist[dist.length - 1], 10);
          if (!isNaN(lastCount)) {
            // Closer to base of arrowhead (1/3 from base)
            const hcx = baseX + (finalTipX - baseX) * 0.3;
            const hcy = baseY + (finalTipY - baseY) * 0.3;
            drops.push({
              cx: hcx,
              cy: hcy,
              r,
              fontSize,
              count: lastCount,
              inHead: true,
            });
          }
        }
      }

      return {
        shape: "arrow",
        x1: geometry.x1,
        y1: geometry.y1,
        x2: geometry.x2,
        y2: geometry.y2,
        headPoints: geometry.headPoints,
        headClass: "head-p" + p,
        headBorderClass: "head-border-p" + p,
        borderClass: "arrow-border-p" + p,
        classes: "arrow-p" + p,
        textClass: "drop-count-p" + p,
        strokeWidth,
        borderStrokeWidth,
        headBorderWidth: borderWidth,
        opacity: move.strength,
        drops,
      };
    },
  },
};
</script>

<style lang="scss">
.analysis-overlay-wrap {
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
}
.analysis-overlay-wrap-3d {
  transform-style: preserve-3d;
}
.analysis-overlay {
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;

  .stone-p1 {
    fill: var(--q-color-player1flatOpaque);
    stroke: var(--q-color-player1border);
  }
  .stone-p2 {
    fill: var(--q-color-player2flatOpaque);
    stroke: var(--q-color-player2border);
  }
  .special-p1 {
    fill: var(--q-color-player1special);
    stroke: var(--q-color-player1border);
  }
  .special-p2 {
    fill: var(--q-color-player2special);
    stroke: var(--q-color-player2border);
  }
  .arrow-p1 {
    stroke: var(--q-color-player1flatOpaque);
  }
  .arrow-p2 {
    stroke: var(--q-color-player2flatOpaque);
  }
  .arrow-border-p1 {
    stroke: var(--q-color-player1border);
  }
  .arrow-border-p2 {
    stroke: var(--q-color-player2border);
  }
  .head-p1 {
    fill: var(--q-color-player1flatOpaque);
  }
  .head-p2 {
    fill: var(--q-color-player2flatOpaque);
  }
  .head-border-p1 {
    stroke: var(--q-color-player1border);
    stroke-linejoin: round;
  }
  .head-border-p2 {
    stroke: var(--q-color-player2border);
    stroke-linejoin: round;
  }
  .drop-count {
    font-family: sans-serif;
    font-weight: 700;
  }
  .drop-count-p1 {
    fill: var(--q-color-textDark);
    body.player1FlatDark & {
      fill: var(--q-color-textLight);
    }
  }
  .drop-count-p2 {
    fill: var(--q-color-textDark);
    body.player2FlatDark & {
      fill: var(--q-color-textLight);
    }
  }
}
</style>
