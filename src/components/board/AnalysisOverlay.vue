<template>
  <div v-if="active && vizLayers.length" class="analysis-overlay-wrap">
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
              dominant-baseline="middle"
              alignment-baseline="middle"
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

export default {
  name: "AnalysisOverlay",
  computed: {
    active() {
      return this.$store.state.ui.showAnalysisBoard;
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
    analysisSource() {
      return this.$store.state.analysis.analysisSource;
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
      return this.$store.state.analysis.hoveredOverlayPlyText;
    },
    pieceBorderWidth() {
      const theme = this.$store.state.ui.theme;
      const v = theme && theme.vars && theme.vars["piece-border-width"];
      return (v != null ? Number(v) : 1) * 0.013 * 0.5;
    },
    rawMoves() {
      if (!this.active) return [];

      switch (this.analysisSource) {
        case "openings":
          return this.$store.state.analysis.currentOpeningMoves || [];
        case "engines": {
          const analysis = this.$store.state.analysis;
          const botID = analysis.botID;
          if (!botID) return [];
          const positions = analysis.botPositions[botID];
          return positions ? positions[this.tps] || [] : [];
        }
        case "saved": {
          const analysis = this.$store.state.analysis;
          const allSuggestions = this.$store.getters["game/suggestions"](
            this.tps
          );
          if (!allSuggestions || allSuggestions.length === 0) return [];
          const savedBotName = analysis.savedBotName;
          if (savedBotName === null) {
            return allSuggestions.filter((s) => !s.botName);
          }
          return allSuggestions.filter((s) => s.botName === savedBotName);
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
      const arrowGroupMap = this.groupOverlappingArrows(movements);

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
          let maxHeight = 0;
          m.ply.squares.forEach((coord) => {
            const sq = this.boardSquares[coord];
            if (sq && sq.pieces) {
              maxHeight = Math.max(maxHeight, sq.pieces.length);
            }
          });
          if (maxHeight > 0) {
            const z = (maxHeight - 1) / 5 + 0.15;
            style = {
              transform: `translateZ(calc(var(--square-size) * ${z}))`,
            };
          }
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
      const K = 4; // Sensitivity constant for opacity curve

      if (moves.length === 0) return [];
      if (moves.length === 1) return [DEFAULT_OPACITY];

      const subjEvals = this.computeSubjectiveEvals(moves);

      // Top suggestion (index 0) always gets DEFAULT_OPACITY.
      // Others use exponential formula: 0.2 + 0.8 * e^(k * (x - B) / B)
      // This is more sensitive for moves close to best, less sensitive for blunders.
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
      const MIN_SCALE = 0.55;
      const MAX_SCALE = 1.2;
      const K = 2;

      if (moves.length === 0) return [];
      if (moves.length === 1) return [MAX_SCALE];

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

    groupOverlappingArrows(movements) {
      const result = new Map();

      function getEdges(ply) {
        const sqs = ply.squares || [];
        const edges = new Set();
        for (let i = 0; i < sqs.length - 1; i++) {
          const a = sqs[i];
          const b = sqs[i + 1];
          edges.add(a < b ? a + "-" + b : b + "-" + a);
        }
        return edges;
      }

      const byAxis = {};
      movements.forEach((m) => {
        const dir = m.ply.direction || "";
        const axis = dir === ">" || dir === "<" ? "h" : "v";
        if (!byAxis[axis]) byAxis[axis] = [];
        byAxis[axis].push(m);
      });

      for (const axis in byAxis) {
        const axisArrows = byAxis[axis];
        const edgeSets = axisArrows.map((m) => getEdges(m.ply));

        const edgeToArrows = {};
        axisArrows.forEach((_, i) => {
          for (const e of edgeSets[i]) {
            if (!edgeToArrows[e]) edgeToArrows[e] = [];
            edgeToArrows[e].push(i);
          }
        });

        // Greedy lane assignment
        const lane = new Array(axisArrows.length).fill(-1);
        for (let i = 0; i < axisArrows.length; i++) {
          const usedLanes = new Set();
          for (const e of edgeSets[i]) {
            for (const j of edgeToArrows[e]) {
              if (j !== i && lane[j] >= 0) usedLanes.add(lane[j]);
            }
          }
          let l = 0;
          while (usedLanes.has(l)) l++;
          lane[i] = l;
        }

        for (let i = 0; i < axisArrows.length; i++) {
          let maxOnEdge = 1;
          for (const e of edgeSets[i]) {
            maxOnEdge = Math.max(maxOnEdge, edgeToArrows[e].length);
          }
          result.set(axisArrows[i], {
            index: lane[i],
            groupSize: maxOnEdge,
          });
        }
      }

      return result;
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
      const maxScale = 1.2;
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

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return null;

      const ndx = dx / len;
      const ndy = dy / len;

      // Perpendicular offset for grouped arrows
      let perpOffset = 0;
      if (groupSize > 1) {
        const spacing = 0.22;
        perpOffset = (-(groupSize - 1) / 2 + indexInGroup) * spacing;
      }
      const px = -ndy;
      const py = ndx;
      const ox = px * perpOffset;
      const oy = py * perpOffset;

      const startShorten = 0.3;
      const endShorten = 0.15;
      const headLen = 0.2;
      const headHalf = 0.1;
      const borderWidth = this.pieceBorderWidth;
      const strokeWidth = 0.08 * strengthScale;
      const borderStrokeWidth = strokeWidth + borderWidth * 2;
      const shaftStartInset = 0.05;

      // Determine if this arrow is vertical on screen (after board transform)
      const isVerticalOnScreen = Math.abs(dy) > Math.abs(dx);
      let bottomOffset = 0;

      if (isVerticalOnScreen && !this.board3D) {
        // Find which square is visually lower in SVG coordinates
        // SVG y increases downward, so larger y = lower on screen
        const fromIsBottom = from.y > to.y;
        const bottomSquare = fromIsBottom
          ? squares[0]
          : squares[squares.length - 1];
        const sq = this.boardSquares[bottomSquare];
        if (sq && sq.pieces && sq.pieces.length > 0) {
          const SPACING = 0.07; // 7% of square size
          const stackHeight = sq.pieces.length;
          const topRef = sq.piece || sq.pieces[stackHeight - 1];
          const topPiece =
            typeof topRef === "string" ? this.boardPieces[topRef] : topRef;
          const topIsWall =
            !!topPiece &&
            (topPiece.isStanding ||
              topPiece.typeCode === "S" ||
              topPiece.type === "wall");
          // Base offset: position at the top of the stack
          // Top piece is at index stackHeight-1, positioned at SPACING * (stackHeight-1)
          // Wall stacks are lowered by one SPACING in 2D, so subtract it.
          let offset = SPACING * (stackHeight - 1);
          if (topIsWall && stackHeight > 1) {
            offset -= SPACING;
          }
          bottomOffset = offset;
        }
      }

      // Tip of the arrowhead
      const tipX = to.x - ndx * endShorten + ox;
      const tipY = to.y - ndy * endShorten + oy;
      // Base center of the arrowhead
      let baseX = tipX - ndx * headLen;
      let baseY = tipY - ndy * headLen;

      // Compute final arrowhead tip position early for drop count calculation
      let finalTipX = tipX;
      let finalTipY = tipY;
      let sourceAdvance = startShorten;

      // Line stops at arrowhead base
      // For vertical arrows, shorten from bottom side by the stack height offset
      let x1 = from.x + ndx * (startShorten + shaftStartInset) + ox;
      let y1 = from.y + ndy * (startShorten + shaftStartInset) + oy;
      let x2 = baseX;
      let y2 = baseY;

      if (isVerticalOnScreen && !this.board3D && bottomOffset > 0) {
        // Apply additional offset to the bottom-most endpoint
        // SVG y increases downward, so larger y = visually lower
        // If from.y > to.y: from is lower on screen, arrow points up, offset at source
        // If from.y < to.y: to is lower on screen, arrow points down, offset at destination
        if (from.y > to.y) {
          // Arrow points up, from is lower - offset the source end
          sourceAdvance = startShorten + bottomOffset;
          x1 = from.x + ndx * (sourceAdvance + shaftStartInset) + ox;
          y1 = from.y + ndy * (sourceAdvance + shaftStartInset) + oy;
        } else {
          // Arrow points down, to is lower - offset the destination end
          const adjustedEndShorten = endShorten + bottomOffset;
          finalTipX = to.x - ndx * adjustedEndShorten + ox;
          finalTipY = to.y - ndy * adjustedEndShorten + oy;
          baseX = finalTipX - ndx * headLen;
          baseY = finalTipY - ndy * headLen;
          x2 = baseX;
          y2 = baseY;
        }
      }

      // Arrowhead wing points (perpendicular to direction)
      const lx = baseX + px * headHalf;
      const ly = baseY + py * headHalf;
      const rx = baseX - px * headHalf;
      const ry = baseY - py * headHalf;

      // Compute drop count indicators
      const drops = [];
      const dist = ply.distribution;
      const pickup = parseInt(ply.pieceCount, 10) || 1;
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
        x1,
        y1,
        x2,
        y2,
        headPoints: `${finalTipX},${finalTipY} ${lx},${ly} ${rx},${ry}`,
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
