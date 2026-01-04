<template>
  <div
    v-if="hoveredPly"
    ref="plyTooltip"
    class="ply-preview-tooltip"
    :style="tooltipStyle"
    :class="{ transition: isMoving }"
  >
    <GameThumbnail
      :tps="hoveredPly.tps"
      :plies="hoveredPly.plies"
      :hl="hoveredPly.hl"
      :config="thumbnailConfig"
      :width="thumbnailSize.width"
      :height="thumbnailSize.height"
    />
  </div>
</template>

<script>
import GameThumbnail from "../controls/GameThumbnail";
import { heights as thumbnailHeights } from "../controls/PlyPreview";
import { pickBy } from "lodash";

const THUMBNAIL_WIDTH = 270;
const LONG_PRESS_DELAY = 250;
const HIDE_DELAY = 150;

export default {
  name: "PlyTooltipProvider",
  components: { GameThumbnail },
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
    };
  },
  computed: {
    thumbnailConfig() {
      return {
        imageSize: "md",
        turnIndicator: true,
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
  },
  mounted() {
    document.addEventListener("mouseover", this.onMouseOver, true);
    document.addEventListener("mouseout", this.onMouseOut, true);
    document.addEventListener("touchstart", this.onTouchStart, true);
    document.addEventListener("touchend", this.onTouchEnd, true);
    document.addEventListener("touchcancel", this.onTouchEnd, true);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  },
  beforeDestroy() {
    document.removeEventListener("mouseover", this.onMouseOver, true);
    document.removeEventListener("mouseout", this.onMouseOut, true);
    document.removeEventListener("touchstart", this.onTouchStart, true);
    document.removeEventListener("touchend", this.onTouchEnd, true);
    document.removeEventListener("touchcancel", this.onTouchEnd, true);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.clearTouchTimer();
    this.clearHideTimer();
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
    getPlyDataFromElement(el) {
      if (!el || !el.dataset) return null;
      const pliesAttr = el.dataset.plies;
      return {
        id: el.dataset.plyId,
        tps: el.dataset.tps || el.dataset.tpsAfter,
        plies: pliesAttr ? JSON.parse(pliesAttr) : null,
        hl: el.dataset.plyText,
      };
    },
    updateTooltipPosition(el) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const tooltipWidth = this.thumbnailSize.width;
      const tooltipHeight = this.thumbnailSize.height;

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
      this.hoveredElement = el;
      this.hoveredPly = plyData;
      this.$nextTick(() => this.updateTooltipPosition(el));
    },
    hidePlyTooltip() {
      this.hoveredPly = null;
      this.hoveredElement = null;
      this.isMoving = false;
      this.clearTouchTimer();
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
    onMouseOver(event) {
      const plyEl = this.findPlyElement(event.target);
      if (plyEl && plyEl !== this.hoveredElement) {
        this.showPlyTooltip(plyEl);
      }
    },
    onMouseOut(event) {
      const plyEl = this.findPlyElement(event.relatedTarget);
      if (!plyEl) {
        this.scheduleHide();
      }
    },
    onTouchStart(event) {
      const plyEl = this.findPlyElement(event.target);
      if (!plyEl) {
        this.hidePlyTooltip();
        return;
      }

      this.clearTouchTimer();
      this.touchTimer = setTimeout(() => {
        this.showPlyTooltip(plyEl);
      }, LONG_PRESS_DELAY);
    },
    onTouchEnd() {
      this.clearTouchTimer();
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
}
</style>
