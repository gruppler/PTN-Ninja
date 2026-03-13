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
        />
        <circle
          v-if="el.shape === 'cap'"
          :key="'v' + i"
          :cx="el.cx"
          :cy="el.cy"
          :r="el.r"
          :class="el.classes"
          :opacity="el.opacity"
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
        />
        <g v-if="el.shape === 'arrow'" :key="'v' + i" :opacity="el.opacity">
          <line
            :x1="el.x1"
            :y1="el.y1"
            :x2="el.x2"
            :y2="el.y2"
            :class="el.classes"
            :stroke-width="el.strokeWidth"
            stroke-linecap="round"
          />
          <polygon :points="el.headPoints" :class="el.headClass" />
          <g v-for="(drop, di) in el.drops" :key="'d' + di">
            <polygon
              v-if="drop.isPickup"
              :points="drop.bgPoints"
              :class="el.headClass"
            />
            <circle
              v-if="!drop.inHead && !drop.isPickup"
              :cx="drop.cx"
              :cy="drop.cy"
              :r="drop.r"
              :class="el.headClass"
            />
            <text
              v-if="drop.count !== null"
              :x="drop.cx"
              :y="drop.cy"
              :font-size="drop.fontSize"
              :class="['drop-count', el.textClass]"
              text-anchor="middle"
              dominant-baseline="central"
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
    boardSize() {
      return this.$store.state.game.config.size;
    },
    textTab() {
      return this.$store.state.ui.textTab;
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
    rawMoves() {
      if (!this.active) return [];

      switch (this.textTab) {
        case "openings":
          return this.$store.state.analysis.currentOpeningMoves || [];
        case "engines": {
          const analysis = this.$store.state.analysis;
          const botID = analysis.botID;
          if (!botID) return [];
          const positions = analysis.botPositions[botID];
          return positions ? positions[this.tps] || [] : [];
        }
        case "notes": {
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

      const strengths = this.computeStrengths(validMoves);

      return validMoves.map((m, i) => ({
        ply: m.ply,
        strength: strengths[i],
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
          const scale = this.getGroupScale(group.length);

          group.forEach((m, i) => {
            elements.push(
              this.createStoneElement(m, center, offsets[i], scale)
            );
          });
        }
        layers.push({ elements, style: {} });
      }

      // Arrow layers (each arrow gets its own Z based on tallest stack)
      const movementGroups = {};
      movements.forEach((m) => {
        const key = m.ply.column + "" + m.ply.row + m.ply.direction;
        if (!movementGroups[key]) movementGroups[key] = [];
        movementGroups[key].push(m);
      });

      movements.forEach((m) => {
        const key = m.ply.column + "" + m.ply.row + m.ply.direction;
        const group = movementGroups[key];
        const index = group.indexOf(m);
        const el = this.createArrowElement(m, index, group.length);
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
        layers.push({ elements: [el], style });
      });

      return layers;
    },
  },
  methods: {
    coordToSvg(coord) {
      const bx = "abcdefgh".indexOf(coord[0]);
      const by = parseInt(coord.slice(1), 10) - 1;
      const t = this.transform;
      const s = this.boardSize;

      let row, col;
      if (t[0] % 2) {
        row = bx;
        col = by;
      } else {
        row = by;
        col = bx;
      }
      if (t[0] === 1 || t[0] === 2) {
        row = s - 1 - row;
      }
      const rotation = (t[0] + 2 * t[1]) % 4;
      if (rotation === 2 || rotation === 3) {
        col = s - 1 - col;
      }

      return { x: col + 0.5, y: s - 0.5 - row };
    },

    getStoneType(ply) {
      if (ply.specialPiece === "C") return "cap";
      if (ply.specialPiece === "S") return "wall";
      return "flat";
    },

    computeStrengths(moves) {
      if (moves.length === 0) return [];
      if (moves.length === 1) return [0.9];

      if (this.textTab === "openings") {
        const winRates = moves.map((m) => {
          if (!m.totalGames || m.totalGames === 0) return 0.5;
          const wins = this.turn === 1 ? m.wins1 : m.wins2;
          const draws = m.draws || 0;
          return (wins + draws * 0.5) / m.totalGames;
        });
        return this.normalizeStrengths(winRates);
      } else {
        const evals = moves.map((m) => {
          if (m.evaluation === null || m.evaluation === undefined) return null;
          return this.turn === 1 ? m.evaluation : -m.evaluation;
        });

        const validEvals = evals.filter((e) => e !== null);
        if (validEvals.length === 0) {
          return moves.map(() => 0.7);
        }

        const sorted = [...validEvals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const filled = evals.map((e) => (e !== null ? e : median));
        return this.normalizeStrengths(filled);
      }
    },

    normalizeStrengths(values) {
      const MIN_OPACITY = 0.3;
      const MAX_OPACITY = 0.9;

      const max = Math.max(...values);
      const min = Math.min(...values);
      const range = max - min;

      if (range === 0) {
        return values.map(() => (MIN_OPACITY + MAX_OPACITY) / 2);
      }

      return values.map(
        (v) => MIN_OPACITY + ((MAX_OPACITY - MIN_OPACITY) * (v - min)) / range
      );
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

    getGroupScale(count) {
      if (count === 1) return 1;
      if (count <= 2) return 0.75;
      return 0.6;
    },

    createStoneElement(move, center, offset, scale) {
      const cx = center.x + offset.dx;
      const cy = center.y + offset.dy;
      const p = move.color;

      if (move.stoneType === "cap") {
        const r = 0.17 * scale;
        return {
          shape: "cap",
          cx,
          cy,
          r,
          classes: "special-p" + p,
          opacity: move.strength,
        };
      } else if (move.stoneType === "wall") {
        const w = 0.1 * scale;
        const h = 0.35 * scale;
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
        };
      } else {
        const sz = 0.35 * scale;
        return {
          shape: "flat",
          x: cx - sz / 2,
          y: cy - sz / 2,
          w: sz,
          h: sz,
          rx: sz * 0.12,
          classes: "stone-p" + p,
          opacity: move.strength,
        };
      }
    },

    createArrowElement(move, indexInGroup, groupSize) {
      const ply = move.ply;
      const squares = ply.squares;
      if (!squares || squares.length < 2) return null;

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

      // Tip of the arrowhead
      const tipX = to.x - ndx * endShorten + ox;
      const tipY = to.y - ndy * endShorten + oy;
      // Base center of the arrowhead
      const baseX = tipX - ndx * headLen;
      const baseY = tipY - ndy * headLen;

      // Line stops at arrowhead base
      const x1 = from.x + ndx * startShorten + ox;
      const y1 = from.y + ndy * startShorten + oy;

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
        const pCx = x1 + ndx * 0.03;
        const pCy = y1 + ndy * 0.03;
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
            const hcx = baseX + (tipX - baseX) * 0.3;
            const hcy = baseY + (tipY - baseY) * 0.3;
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
        x2: baseX,
        y2: baseY,
        headPoints: `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`,
        headClass: "head-p" + p,
        classes: "arrow-p" + p,
        textClass: "drop-count-p" + p,
        strokeWidth: 0.08,
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
    fill: var(--q-color-player1flat);
    stroke: var(--q-color-player1border);
    stroke-width: 0.02;
  }
  .stone-p2 {
    fill: var(--q-color-player2flat);
    stroke: var(--q-color-player2border);
    stroke-width: 0.02;
  }
  .special-p1 {
    fill: var(--q-color-player1special);
    stroke: var(--q-color-player1border);
    stroke-width: 0.02;
  }
  .special-p2 {
    fill: var(--q-color-player2special);
    stroke: var(--q-color-player2border);
    stroke-width: 0.02;
  }
  .arrow-p1 {
    stroke: var(--q-color-player1);
  }
  .arrow-p2 {
    stroke: var(--q-color-player2);
  }
  .head-p1 {
    fill: var(--q-color-player1);
  }
  .head-p2 {
    fill: var(--q-color-player2);
  }
  .drop-count {
    font-family: sans-serif;
  }
  .drop-count-p1 {
    fill: var(--q-color-textDark);
    body.player1Dark & {
      fill: var(--q-color-textLight);
    }
  }
  .drop-count-p2 {
    fill: var(--q-color-textDark);
    body.player2Dark & {
      fill: var(--q-color-textLight);
    }
  }
}
</style>
