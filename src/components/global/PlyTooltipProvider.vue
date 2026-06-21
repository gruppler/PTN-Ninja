<template>
  <div
    v-if="activePreview"
    ref="plyTooltip"
    class="ply-preview-tooltip"
    :class="{ transition: isMoving, interactive: !!pvNav }"
    :style="tooltipStyle"
  >
    <GameThumbnail
      :tps="activePreview.tps"
      :plies="activePreview.plies"
      :hl="activePreview.hl"
      :config="thumbnailConfig"
      :width="thumbnailSize.width"
      :height="thumbnailSize.height"
    />
    <div v-if="pvNav" class="pv-nav" @click.stop>
      <span class="pv-nav-move small" v-if="pvCurrentMove">
        <span class="pv-nav-number">{{ pvCurrentMove.number }}.</span>
        <Ply
          v-if="pvCurrentPly"
          :ply="pvCurrentPly"
          :selected="false"
          :done="true"
          no-click
          no-branches
          no-result
        />
        <span
          v-else
          class="pv-nav-text"
          :class="'player' + pvCurrentMove.color"
          >{{ pvCurrentMove.text }}</span
        >
      </span>
      <span class="pv-nav-buttons">
        <q-btn
          icon="backward"
          size="sm"
          flat
          dense
          :disable="pvNavIndexClamped <= 1"
          @click.stop="pvStep(-1)"
        />
        <span class="pv-nav-index"
          >{{ pvNavIndexClamped }}/{{ pvMaxIndex }}</span
        >
        <q-btn
          icon="forward"
          size="sm"
          flat
          dense
          :disable="pvNavIndexClamped >= pvMaxIndex"
          @click.stop="pvStep(1)"
        />
      </span>
    </div>
    <div
      v-else-if="activePreview.note"
      class="ply-preview-note"
      v-html="activePreview.note"
    />
  </div>
</template>

<script>
import GameThumbnail from "../controls/GameThumbnail";
import Ply from "../PTN/Ply";
import PlyModel from "../../Game/PTN/Ply";
import { heights as thumbnailHeights } from "../controls/PlyPreview";
import { isObject, pickBy } from "lodash";

const THUMBNAIL_WIDTH = 270;
const LONG_PRESS_DELAY = 250;
const HIDE_DELAY = 150;
// Minimum pointer travel before a touch is treated as a PV drag rather than a
// tap (which should fall through to the ply's click) or a vertical scroll.
const TOUCH_DRAG_THRESHOLD = 8;

export default {
  name: "PlyTooltipProvider",
  components: { GameThumbnail, Ply },
  inject: {
    layout: {
      default: null,
    },
  },
  data() {
    return {
      hoveredPly: null,
      hoveredElement: null,
      touchTimer: null,
      hideTimer: null,
      tooltipPosition: { x: 0, y: 0 },
      isMoving: false,
      isTouchActive: false,
      touchStartedOnPly: false,
      mutationObserver: null,
      // PV navigation (when hovering a ply that carries a continuation)
      pvNavIndex: null,
      pvWheelDeltaY: 0,
      pvWheelTimer: null,
      pvTouchPending: false,
      pvTouchActive: false,
      pvTouchEl: null,
      pvTouchStartX: 0,
      pvTouchStartY: 0,
      pvTouchStartIndex: 1,
      // Bounded cache of decoded prefetch images (keeps them warm for cycling).
      preloadedImages: [],
      preloadedUrls: new Set(),
    };
  },
  computed: {
    // Present when the hovered ply belongs to an analysis suggestion that has a
    // continuation. Holds the full PV (ply texts), parallel move-display info,
    // and the starting TPS.
    pvNav() {
      const p = this.hoveredPly;
      if (p && p.pv && p.pv.length) {
        return { pv: p.pv, moves: p.pvMoves || [], tps: p.pvTps };
      }
      return null;
    },
    pvMaxIndex() {
      return this.pvNav ? this.pvNav.pv.length : 0;
    },
    pvNavIndexClamped() {
      if (!this.pvNav) return 0;
      const idx = this.pvNavIndex == null ? 1 : this.pvNavIndex;
      return Math.max(1, Math.min(this.pvMaxIndex, idx));
    },
    pvCurrentMove() {
      if (!this.pvNav) return null;
      return this.pvNav.moves[this.pvNavIndexClamped - 1] || null;
    },
    // Parse the current PV move into a Ply model so it can render through the
    // shared Ply component (matching the colored notation used everywhere else)
    // instead of plain text. Falls back to null (plain text) on parse failure.
    pvCurrentPly() {
      const move = this.pvCurrentMove;
      if (!move || !move.text) return null;
      try {
        return new PlyModel(move.text, {
          id: null,
          color: move.color,
          player: move.player != null ? move.player : move.color,
        });
      } catch (error) {
        return null;
      }
    },
    activePreview() {
      if (!this.hoveredPly) return null;
      if (this.pvNav) {
        const idx = this.pvNavIndexClamped;
        return {
          tps: this.pvNav.tps,
          plies: this.pvNav.pv.slice(0, idx),
          hl: this.pvNav.pv[idx - 1],
          note: null,
        };
      }
      return this.hoveredPly;
    },
    thumbnailConfig() {
      return {
        imageSize: "md",
        turnIndicator: true,
        flatCounts: this.$store.state.ui.flatCounts,
        centerStackCounts: this.$store.state.ui.centerStackCounts,
        unplayedPieces: true,
        ...pickBy(
          this.$store.state.game.config,
          (v) => v !== null && v !== undefined
        ),
      };
    },
    thumbnailSize() {
      const size = this.$store.state.game.config?.size;
      return {
        width: THUMBNAIL_WIDTH,
        height: size ? thumbnailHeights[size] : 200,
      };
    },
    tooltipStyle() {
      const style = {
        left: this.tooltipPosition.x + "px",
        top: this.tooltipPosition.y + "px",
      };
      return style;
    },
  },
  watch: {
    $route() {
      this.hidePlyTooltip();
    },
    "$store.state.ui.textTab"() {
      this.hidePlyTooltip();
    },
    "$store.state.ui.branchMenuOpen"(isOpen) {
      if (isOpen) {
        this.hidePlyTooltip();
      }
    },
    "$store.state.game.ptnUI.branchPointOverrides"() {
      this.hidePlyTooltip();
    },
  },
  mounted() {
    document.addEventListener("mouseover", this.onMouseOver, true);
    document.addEventListener("mouseout", this.onMouseOut, true);
    document.addEventListener("wheel", this.onWheel, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchstart", this.onTouchStart, true);
    document.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchend", this.onTouchEnd, true);
    document.addEventListener("touchcancel", this.onTouchEnd, true);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  },
  beforeDestroy() {
    document.removeEventListener("mouseover", this.onMouseOver, true);
    document.removeEventListener("mouseout", this.onMouseOut, true);
    document.removeEventListener("wheel", this.onWheel, {
      passive: false,
      capture: true,
    });
    document.removeEventListener("touchstart", this.onTouchStart, true);
    document.removeEventListener("touchmove", this.onTouchMove, {
      passive: false,
      capture: true,
    });
    document.removeEventListener("touchend", this.onTouchEnd, true);
    document.removeEventListener("touchcancel", this.onTouchEnd, true);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.clearTouchTimer();
    this.clearHideTimer();
    clearTimeout(this.pvWheelTimer);
    this.stopObservingElement();
  },
  methods: {
    findPlyElement(target) {
      let el = target;
      while (el && el !== document.body) {
        if (el.dataset && ("tpsAfter" in el.dataset || "tps" in el.dataset)) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    },
    isInTooltip(target) {
      const tooltip = this.$refs.plyTooltip;
      if (!tooltip || !target || !target.nodeType) return false;
      return tooltip === target || tooltip.contains(target);
    },
    getPlyDataFromElement(el) {
      if (!el || !el.dataset) return null;
      const pliesAttr = el.dataset.plies;
      let note = el.dataset.note || null;
      if (!note) {
        const noteEl = el.querySelector("[data-note]");
        if (noteEl) {
          note = noteEl.dataset.note;
        }
      }
      let pv = null;
      let pvIndex = null;
      let pvTps = null;
      let pvMoves = null;
      if (el.dataset.pv) {
        try {
          pv = JSON.parse(el.dataset.pv);
        } catch (error) {
          pv = null;
        }
        if (pv) {
          pvIndex = parseInt(el.dataset.pvIndex, 10) || 1;
          pvTps = el.dataset.pvTps || el.dataset.tps || el.dataset.tpsAfter;
          if (el.dataset.pvMoves) {
            try {
              pvMoves = JSON.parse(el.dataset.pvMoves);
            } catch (error) {
              pvMoves = null;
            }
          }
        }
      }
      return {
        id: el.dataset.plyId,
        tps: el.dataset.tps || el.dataset.tpsAfter,
        plies: pliesAttr ? JSON.parse(pliesAttr) : null,
        hl: el.dataset.plyText,
        note,
        pv,
        pvIndex,
        pvTps,
        pvMoves,
      };
    },
    updateTooltipPosition(el) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const tooltipWidth = this.thumbnailSize.width;
      const tooltipEl = this.$refs.plyTooltip;
      const tooltipHeight = tooltipEl
        ? tooltipEl.offsetHeight
        : this.thumbnailSize.height;

      let x = rect.left + rect.width / 2 - tooltipWidth / 2;
      let y = rect.top - tooltipHeight - 10;

      // Keep tooltip within viewport bounds
      const padding = 10;
      x = Math.max(
        padding,
        Math.min(x, window.innerWidth - tooltipWidth - padding)
      );

      // If tooltip would go above viewport, show below element instead
      if (y < padding) {
        y = rect.bottom + padding;
      } else {
        y -= padding;
      }

      // Keep within bottom of viewport
      if (y + tooltipHeight > window.innerHeight - padding) {
        y = window.innerHeight - tooltipHeight - padding;
      }

      this.tooltipPosition = { x, y };
    },
    showPlyTooltip(el) {
      const plyData = this.getPlyDataFromElement(el);
      if (!plyData || !plyData.tps) return;

      this.clearHideTimer();
      const wasVisible = this.hoveredPly !== null;
      this.isMoving = wasVisible;

      // Stop observing old element
      if (this.hoveredElement && this.hoveredElement !== el) {
        this.stopObservingElement();
      }

      this.hoveredElement = el;
      this.hoveredPly = plyData;
      // Anchor the PV nav at the ply the pointer is on; subsequent cycling only
      // changes the depth, never the anchor, so the tooltip stays in place.
      this.pvNavIndex = plyData.pv ? plyData.pvIndex : null;
      this.$nextTick(() => this.updateTooltipPosition(el));

      // Warm the thumbnail cache for the other PV depths so cycling is instant.
      if (plyData.pv) {
        this.prefetchPvThumbnails();
      }

      // Start observing new element for attribute changes
      this.startObservingElement(el);
    },
    // Build the same options GameThumbnail passes to GET_THUMBNAIL so the cache
    // hash matches and a prefetched depth is reused when actually shown.
    buildThumbnailOptions(tps, plies, hl) {
      const options = {
        ...this.thumbnailConfig,
        tps,
        plies,
        hl,
        plyIsDone: true,
      };
      if (isObject(options.pieceCounts)) {
        options.caps1 = options.pieceCounts[1].cap;
        options.flats1 = options.pieceCounts[1].flat;
        options.caps2 = options.pieceCounts[2].cap;
        options.flats2 = options.pieceCounts[2].flat;
      }
      return options;
    },
    requestPvThumbnail(tps, pv, depth, priority) {
      const options = this.buildThumbnailOptions(
        tps,
        pv.slice(0, depth),
        pv[depth - 1]
      );
      this.$store
        .dispatch(
          "ui/GET_THUMBNAIL",
          priority ? { ...options, priority: true } : options
        )
        .then((url) => this.preloadImage(url))
        .catch(() => {});
    },
    // GET_THUMBNAIL only produces the object URL (rendered to a blob); the
    // browser doesn't decode the PNG until it's actually loaded. Decode it now
    // so cycling to this depth shows it instantly instead of flickering during
    // a first-time decode. Keep a bounded set of Images alive so the decoded
    // data isn't discarded before use.
    preloadImage(url) {
      if (!url || this.preloadedUrls.has(url)) return;
      const img = new Image();
      img.src = url;
      this.preloadedUrls.add(url);
      this.preloadedImages.push(img);
      // Force the decode so it's cached before the image is shown.
      if (img.decode) {
        img.decode().catch(() => {});
      }
      if (this.preloadedImages.length > 24) {
        const old = this.preloadedImages.shift();
        if (old) this.preloadedUrls.delete(old.src);
      }
    },
    prefetchPvThumbnails() {
      if (!this.pvNav) return;
      const { pv, tps } = this.pvNav;
      const current = this.pvNavIndexClamped;
      // Render the hovered depth first (priority) so the visible thumbnail
      // appears ASAP; in-flight dedup means the live GameThumbnail's request
      // for the same depth coalesces rather than rendering it twice.
      this.requestPvThumbnail(tps, pv, current, true);
      for (let i = 1; i <= pv.length; i++) {
        if (i === current) continue;
        this.requestPvThumbnail(tps, pv, i, false);
      }
    },
    hidePlyTooltip() {
      this.stopObservingElement();
      this.hoveredPly = null;
      this.hoveredElement = null;
      this.isMoving = false;
      this.pvNavIndex = null;
      this.clearTouchTimer();
    },
    startObservingElement(el) {
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
      }
      this.mutationObserver = new MutationObserver(() => {
        // Re-read data when attributes change
        if (this.hoveredElement) {
          const newData = this.getPlyDataFromElement(this.hoveredElement);
          if (
            newData &&
            newData.tps &&
            (newData.tps !== this.hoveredPly?.tps ||
              JSON.stringify(newData.plies) !==
                JSON.stringify(this.hoveredPly?.plies) ||
              JSON.stringify(newData.pv) !==
                JSON.stringify(this.hoveredPly?.pv) ||
              newData.note !== this.hoveredPly?.note)
          ) {
            // Reset depth only if the PV itself changed
            const pvChanged =
              JSON.stringify(newData.pv) !==
              JSON.stringify(this.hoveredPly?.pv);
            this.hoveredPly = newData;
            if (pvChanged) {
              this.pvNavIndex = newData.pv ? newData.pvIndex : null;
            }
          }
        }
      });
      this.mutationObserver.observe(el, {
        attributes: true,
        attributeFilter: [
          "data-tps",
          "data-tps-after",
          "data-plies",
          "data-note",
          "data-pv",
          "data-pv-index",
          "data-pv-moves",
        ],
        subtree: true,
      });
    },
    stopObservingElement() {
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
        this.mutationObserver = null;
      }
    },
    clearTouchTimer() {
      if (this.touchTimer) {
        clearTimeout(this.touchTimer);
        this.touchTimer = null;
      }
    },
    clearHideTimer() {
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    },
    scheduleHide() {
      this.clearHideTimer();
      this.hideTimer = setTimeout(() => {
        this.hidePlyTooltip();
      }, HIDE_DELAY);
    },
    pvStep(delta) {
      if (!this.pvNav) return;
      this.pvNavIndex = Math.max(
        1,
        Math.min(this.pvMaxIndex, this.pvNavIndexClamped + delta)
      );
    },
    onMouseOver(event) {
      // Keep the tooltip open while the pointer is over it (e.g. to click the
      // PV nav buttons).
      if (this.isInTooltip(event.target)) {
        this.clearHideTimer();
        return;
      }
      const plyEl = this.findPlyElement(event.target);
      if (plyEl) {
        // Check if element changed OR if data attributes changed (e.g., from scrolling suggestions)
        const newData = this.getPlyDataFromElement(plyEl);
        const dataChanged =
          !this.hoveredPly ||
          newData.tps !== this.hoveredPly.tps ||
          JSON.stringify(newData.plies) !==
            JSON.stringify(this.hoveredPly.plies);
        if (plyEl !== this.hoveredElement || dataChanged) {
          this.showPlyTooltip(plyEl);
        }
      }
    },
    onMouseOut(event) {
      // Moving onto the tooltip itself should keep it open.
      if (this.isInTooltip(event.relatedTarget)) {
        this.clearHideTimer();
        return;
      }
      const plyEl = this.findPlyElement(event.relatedTarget);
      if (!plyEl) {
        this.scheduleHide();
      }
    },
    onWheel(event) {
      // Only hijack the wheel while hovering a ply that has a PV; everything
      // else (page/list scrolling) is left untouched.
      if (!this.pvNav || !this.$store.state.ui.scrollNavigation) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const scrollThreshold =
        this.$store.state.ui.scrollThreshold || window.devicePixelRatio * 100;

      this.pvWheelDeltaY += event.deltaY;
      if (Math.abs(this.pvWheelDeltaY) >= scrollThreshold) {
        const times = Math.floor(
          Math.abs(this.pvWheelDeltaY) / scrollThreshold
        );
        const dir = this.pvWheelDeltaY > 0 ? 1 : -1;
        this.pvWheelDeltaY = this.pvWheelDeltaY % scrollThreshold;
        this.pvStep(dir * times);
      }

      clearTimeout(this.pvWheelTimer);
      this.pvWheelTimer = setTimeout(() => {
        this.pvWheelDeltaY = 0;
      }, 300);
    },
    onTouchStart(event) {
      const plyEl = this.findPlyElement(event.target);
      if (!plyEl) {
        this.touchStartedOnPly = false;
        this.hidePlyTooltip();
        return;
      }

      this.touchStartedOnPly = true;
      this.$store.commit("ui/SET_PLY_PREVIEW_ACTIVE", true);

      const data = this.getPlyDataFromElement(plyEl);
      const touch = event.touches[0];
      // PV plies support a horizontal drag to cycle the continuation. We defer
      // deciding (drag vs tap vs vertical scroll) to the first touchmove.
      this.pvTouchPending = !!(data && data.pv);
      this.pvTouchActive = false;
      this.pvTouchEl = this.pvTouchPending ? plyEl : null;
      this.pvTouchStartX = touch ? touch.clientX : 0;
      this.pvTouchStartY = touch ? touch.clientY : 0;

      this.clearTouchTimer();
      this.touchTimer = setTimeout(() => {
        this.isTouchActive = true;
        this.showPlyTooltip(plyEl);
      }, LONG_PRESS_DELAY);
    },
    onTouchMove(event) {
      if (!this.touchStartedOnPly) {
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;

      // Decide whether a pending PV touch becomes a horizontal drag.
      if (this.pvTouchPending && !this.pvTouchActive) {
        const dx = touch.clientX - this.pvTouchStartX;
        const dy = touch.clientY - this.pvTouchStartY;
        if (
          Math.abs(dx) < TOUCH_DRAG_THRESHOLD &&
          Math.abs(dy) < TOUCH_DRAG_THRESHOLD
        ) {
          return;
        }
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical intent: let the list scroll and cancel the preview.
          this.pvTouchPending = false;
          this.clearTouchTimer();
          return;
        }
        // Horizontal drag: enter PV cycling.
        this.pvTouchActive = true;
        this.clearTouchTimer();
        this.showPlyTooltip(this.pvTouchEl);
        this.pvTouchStartIndex = this.pvNavIndexClamped;
      }

      if (this.pvTouchActive) {
        event.preventDefault();
        event.stopPropagation();
        const dx = touch.clientX - this.pvTouchStartX;
        // Map drag distance so the whole PV spans half the screen width, with a
        // per-step floor and cap so very short or very long PVs stay usable.
        const span = Math.max(1, this.pvMaxIndex - 1);
        const stepPx = Math.max(24, Math.min(64, window.innerWidth / 2 / span));
        const steps = Math.round(dx / stepPx);
        this.pvNavIndex = Math.max(
          1,
          Math.min(this.pvMaxIndex, this.pvTouchStartIndex + steps)
        );
        return;
      }

      // Long-press preview drag between adjacent plies (non-PV behavior).
      event.preventDefault();
      event.stopPropagation();
      if (!this.isTouchActive) {
        return;
      }
      const elementUnderTouch = document.elementFromPoint(
        touch.clientX,
        touch.clientY
      );
      const plyEl = this.findPlyElement(elementUnderTouch);
      if (plyEl && plyEl !== this.hoveredElement) {
        this.showPlyTooltip(plyEl);
      }
    },
    onTouchEnd() {
      this.clearTouchTimer();
      this.isTouchActive = false;
      this.touchStartedOnPly = false;
      this.pvTouchPending = false;
      this.pvTouchActive = false;
      this.pvTouchEl = null;
      this.$store.commit("ui/SET_PLY_PREVIEW_ACTIVE", false);
      this.hidePlyTooltip();
    },
    onVisibilityChange() {
      if (document.hidden) {
        this.hidePlyTooltip();
      }
    },
  },
};
</script>

<style lang="scss">
.ply-preview-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  background-color: rgba(#000, 0.8);
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  &.transition {
    transition: left $transition, top $transition;
  }
  // Interactive only when it hosts the PV nav, so its buttons are clickable.
  &.interactive {
    pointer-events: auto;
  }
}

.pv-nav {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 2px 0;
  color: #fff;

  .pv-nav-move {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: "Source Code Pro";
    font-size: 0.9em;
    min-width: 0;

    // The shared Ply chip brings its own margin; drop it so it lines up with
    // the move number.
    .ptn.ply .q-chip {
      margin: 0;
    }
  }

  .pv-nav-number {
    opacity: 0.7;
  }

  .pv-nav-text {
    padding: 0 4px;
    border-radius: 3px;
    font-weight: bold;
    &.player1 {
      background-color: var(--q-color-player1);
      color: var(--q-color-textDark);
      body.player1Dark & {
        color: var(--q-color-textLight);
      }
    }
    &.player2 {
      background-color: var(--q-color-player2);
      color: var(--q-color-textDark);
      body.player2Dark & {
        color: var(--q-color-textLight);
      }
    }
  }

  .pv-nav-buttons {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
  }

  .pv-nav-index {
    font-size: 0.75em;
    min-width: 2.5em;
    text-align: center;
    opacity: 0.85;
  }
}

.ply-preview-note {
  max-width: 270px;
  padding: 4px 2px 0;
  color: #fff;
  word-wrap: break-word;
  a {
    color: var(--q-color-primary);
  }
  code {
    background: rgba(#fff, 0.15);
    padding: 0 0.3em;
    border-radius: 2px;
    font-size: 0.9em;
  }
}
</style>
