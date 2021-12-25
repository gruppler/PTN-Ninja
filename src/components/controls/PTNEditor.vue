<template>
  <form class="fit" spellcheck="false">
    <q-input
      ref="input"
      type="textarea"
      v-model="ptn"
      class="ptn-editor fit"
      :rules="rules"
      @keydown.ctrl.enter.prevent="save"
      hide-bottom-space
      no-error-icon
    />
  </form>
</template>

<script>
import Game from "../../Game";

import { unescape } from "lodash";

export default {
  name: "PTNEditor",
  data() {
    return {
      ptn: "",
      original: "",
      rules: [
        (moves) => {
          const result = Game.validate(this.header + moves);
          if (result === true) {
            return true;
          } else {
            if (this.$te(`error["${result}"]`)) {
              return this.$t(`error["${result}"]`);
            } else {
              console.error(result);
              return result;
            }
          }
        },
      ],
    };
  },
  computed: {
    header() {
      return this.$game.headerText();
    },
    error() {
      return this.$refs.input.computedErrorMessage;
    },
    hasChanges() {
      return this.ptn !== this.original;
    },
  },
  methods: {
    save() {
      this.$emit("save", this.header + this.ptn);
    },
    reset() {
      this.ptn = this.original;
    },
    init() {
      this.original = this.$game
        ? this.$game.moveText(true, true).replace(/\r\n/g, "\n")
        : "";
      this.ptn = this.original;
    },
  },
  watch: {
    ptn() {
      this.$emit("hasChanges", this.hasChanges);
    },
  },
  mounted() {
    this.init();
  },
};
</script>

<style lang="scss">
.ptn-editor {
  font-family: "Source Code Pro";
  font-weight: bold;

  &.q-textarea {
    .q-field__native {
      resize: none;
      padding: 16px;
    }
    .q-field__control {
      height: 100%;
      padding: 0;
    }
  }

  .q-field__bottom {
    display: none;
  }
}
</style>
