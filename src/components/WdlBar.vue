<template>
  <div class="wdl-bar" :class="barClasses">
    <div class="segment p1" :style="segmentStyle(wdl.player1)" />
    <div class="segment draw" :style="segmentStyle(wdl.draw)" />
    <div class="segment p2" :style="segmentStyle(wdl.player2)" />
    <div class="midpoint-marker" :style="markerStyle" />
  </div>
</template>

<script>
const clampPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(100, number));
};

export default {
  name: "WdlBar",
  props: {
    wdl: {
      type: Object,
      required: true,
    },
    direction: {
      type: String,
      default: "row",
      validator(value) {
        return value === "row" || value === "column";
      },
    },
    reverse: {
      type: Boolean,
      default: false,
    },
    segmentOpacity: {
      type: Number,
      default: 0.3,
    },
    markerOpacity: {
      type: Number,
      default: 0.2,
    },
  },
  computed: {
    barClasses() {
      return {
        row: this.direction === "row",
        column: this.direction === "column",
        reverse: this.reverse,
      };
    },
    markerStyle() {
      if (this.direction === "column") {
        return {
          left: 0,
          right: 0,
          top: "50%",
          height: "1px",
          transform: "translateY(-50%)",
          opacity: this.markerOpacity,
        };
      }
      return {
        top: 0,
        bottom: 0,
        left: "50%",
        width: "1px",
        transform: "translateX(-50%)",
        opacity: this.markerOpacity,
      };
    },
  },
  methods: {
    segmentStyle(value) {
      const percent = `${clampPercent(value)}%`;
      return {
        opacity: this.segmentOpacity,
        [this.direction === "column" ? "height" : "width"]: percent,
      };
    },
  },
};
</script>

<style lang="scss">
.wdl-bar {
  position: relative;
  display: flex;
  overflow: hidden;
  width: 100%;
  height: 100%;
  flex-wrap: nowrap;

  &.column {
    flex-direction: column;
    .segment {
      width: 100%;
    }
  }

  &.row {
    flex-direction: row;
    .segment {
      height: 100%;
    }
  }

  &.reverse {
    &.row {
      flex-direction: row-reverse;
    }
    &.column {
      flex-direction: column-reverse;
    }
  }

  .segment {
    flex-shrink: 0;
    will-change: width, height, background-color, opacity;
    transition: width $generic-hover-transition,
      height $generic-hover-transition,
      background-color $generic-hover-transition,
      opacity $generic-hover-transition;

    &.p1 {
      background-color: var(--q-color-player1);
    }

    &.p2 {
      background-color: var(--q-color-player2);
    }

    &.draw {
      background-color: $highlight;
      body.panelDark & {
        background-color: $dim;
      }
    }
  }

  .midpoint-marker {
    position: absolute;
    pointer-events: none;
    z-index: 1;
    background-color: var(--q-color-textDark);
    body.panelDark & {
      background-color: var(--q-color-textLight);
    }
  }
}
</style>
