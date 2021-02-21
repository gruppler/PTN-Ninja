<template>
  <span class="result ptn" :class="{ done, clickable }" v-if="result">
    <span
      class="player1"
      :class="{
        ['result-' + (resultObject.isTie ? 'tie' : resultObject.player1)]: true,
        dark: theme.player1Dark,
      }"
      >{{ resultObject.player1 }}</span
    >
    <span
      class="player2"
      :class="{
        ['result-' + (resultObject.isTie ? 'tie' : resultObject.player2)]: true,
        dark: theme.player2Dark,
      }"
      >{{ resultObject.player2 }}</span
    >
  </span>
</template>

<script>
import Result from "../../Game/PTN/Result";

export default {
  name: "Result",
  props: {
    result: [String, Object],
    done: {
      type: Boolean,
      default: true,
    },
    clickable: Boolean,
  },
  computed: {
    theme() {
      return this.$store.state.ui.theme;
    },
    resultObject() {
      return typeof this.result === "string"
        ? Result.parse(this.result || "")
        : this.result;
    },
  },
};
</script>

<style lang="scss">
.result {
  font-family: "Source Code Pro";
  white-space: nowrap;
  font-weight: bold;
  height: 1.5em;
  margin: 4px;
  display: inline-block;
  vertical-align: middle;

  @media (hover) {
    &.clickable {
      cursor: pointer;
      &:hover {
        .player1:after,
        .player2:after {
          background-color: $highlight;
        }
        &.done {
          .player1:after,
          .player2:after {
            background-color: $highlight;
            &.dark {
              background-color: $dim;
            }
          }
        }
      }
      &:active {
        .player1,
        .player2 {
          box-shadow: $shadow-1;
        }
      }
    }
  }

  .player1,
  .player2 {
    padding: 2px 6px;
    position: relative;
    &:after {
      content: "";
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
      pointer-events: none;
      background-color: rgba(0, 0, 0, 0);
      transition: background-color $generic-hover-transition;
    }
  }
  .result-R {
    color: $green-dark;
  }
  .result-F {
    color: $blue-dark;
  }
  .result-0 {
    color: $red-dark;
  }
  body.panelDark &:not(.done) {
    .result-R {
      color: $green-light;
    }
    .result-F {
      color: $blue-light;
    }
    .result-0 {
      color: $red-light;
    }
  }

  .player1 {
    border-radius: 4px 0 0 4px;
    border: 1px solid $player1;
    border: 1px solid var(--q-color-player1);
    border-right-width: 0;
    &.result-tie,
    &.result-1 {
      color: $player1;
      color: var(--q-color-player1);
    }
  }
  .player2 {
    border-radius: 0 4px 4px 0;
    border: 1px solid $player2;
    border: 1px solid var(--q-color-player2);
    border-left-width: 0;
    &.result-tie,
    &.result-1 {
      color: $player2;
      color: var(--q-color-player2);
    }
  }

  &.done {
    .player1 {
      background-color: $player1;
      background-color: var(--q-color-player1);
      &.result-R {
        color: $green-dark;
      }
      &.result-F {
        color: $blue-dark;
      }
      &.result-0 {
        color: $red-dark;
      }
      &.result-tie,
      &.result-1 {
        color: $textDark;
        color: var(--q-color-textDark);
        body.player1Dark & {
          color: $textLight;
          color: var(--q-color-textLight);
        }
      }
    }
    .player2 {
      background-color: $player2;
      background-color: var(--q-color-player2);
      &.result-R {
        color: $green-light;
      }
      &.result-F {
        color: $blue-light;
      }
      &.result-0 {
        color: $red-light;
      }
      &.result-tie,
      &.result-1 {
        color: $textDark;
        color: var(--q-color-textDark);
        body.player2Dark & {
          color: $textLight;
          color: var(--q-color-textLight);
        }
      }
    }
  }
}
</style>
