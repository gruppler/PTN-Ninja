<template>
  <div class="wdl-bar" :class="barClasses">
    <div class="segment p1" :style="segmentStyle(wdl.player1)" />
    <div class="segment draw" :style="segmentStyle(wdl.draw)" />
    <div class="segment p2" :style="segmentStyle(wdl.player2)" />
    <div
      class="midpoint-marker"
      :class="midpointSegment"
      :style="markerStyle"
    />
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
      default: 0.5,
    },
  },
  computed: {
    theme() {
      return (
        (this.$store && this.$store.state.ui && this.$store.state.ui.theme) ||
        {}
      );
    },
    barClasses() {
      return {
        row: this.direction === "row",
        column: this.direction === "column",
        reverse: this.reverse,
      };
    },
    markerStyle() {
      const segmentDarkness = {
        p1: this.theme.player1Dark,
        p2: this.theme.player2Dark,
        draw: this.theme.secondaryDark,
      }[this.midpointSegment];
      const markerColor = this.contrastTextColor(segmentDarkness);

      if (this.direction === "column") {
        return {
          left: 0,
          right: 0,
          top: "50%",
          height: "1px",
          transform: "translateY(-50%)",
          opacity: this.markerOpacity,
          ...(markerColor ? { backgroundColor: markerColor } : {}),
        };
      }
      return {
        top: 0,
        bottom: 0,
        left: "50%",
        width: "1px",
        transform: "translateX(-50%)",
        opacity: this.markerOpacity,
        ...(markerColor ? { backgroundColor: markerColor } : {}),
      };
    },
    midpointSegment() {
      const values = {
        p1: clampPercent(this.wdl && this.wdl.player1),
        draw: clampPercent(this.wdl && this.wdl.draw),
        p2: clampPercent(this.wdl && this.wdl.player2),
      };
      const visualOrder = this.reverse
        ? ["p2", "draw", "p1"]
        : ["p1", "draw", "p2"];

      const midpoint = 50;
      let cumulative = 0;
      for (let i = 0; i < visualOrder.length; i++) {
        const key = visualOrder[i];
        const segmentSize = values[key] || 0;
        cumulative += segmentSize;
        if (segmentSize > 0 && midpoint <= cumulative) {
          return key;
        }
      }

      return visualOrder[visualOrder.length - 1];
    },
  },
  methods: {
    contrastTextColor(isDarkBackground) {
      return isDarkBackground ? "#ffffff" : "#000000";
    },
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
    background-color: #000000;
    body.panelDark & {
      background-color: #ffffff;
    }

    &.draw {
      background-color: #000000;
      body.panelDark & {
        background-color: #ffffff;
      }
    }
  }
}
</style>
