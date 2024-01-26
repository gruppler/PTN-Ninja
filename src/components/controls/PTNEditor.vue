<template>
  <form class="fit" spellcheck="false">
    <q-input
      ref="input"
      type="textarea"
      v-model="ptn"
      class="ptn-editor fit"
      :rules="rules"
      @keydown.ctrl.enter.prevent="save"
      autofocus
      hide-bottom-space
      no-error-icon
    />
  </form>
</template>

<script>
import Game from "../../Game";

export default {
  name: "PTNEditor",
  props: {
    value: String,
    isNewGame: Boolean,
  },
  data() {
    return {
      ptn: "",
      original: "",
      header: "",
      rules: [
        (moves) => {
          const result = Game.validate(this.header + moves);
          if (result === true) {
            this.$emit("error", "");
            return true;
          } else {
            if (this.$te(`error["${result}"]`)) {
              let error = this.$t(`error["${result}"]`);
              this.$emit("error", error);
              return error;
            } else {
              this.$emit("error", result);
              return result;
            }
          }
        },
      ],
    };
  },
  computed: {
    showHeader() {
      return this.$store.state.ui.editHeader;
    },
    hasChanges() {
      return this.isNewGame || this.ptn !== this.original;
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
      if (this.isNewGame) {
        this.original = this.value || "";
        this.header = "";
      } else if (this.$game) {
        this.original = (
          this.showHeader ? this.$game.ptn : this.$game.moveText(true, true)
        ).replace(/\r\n/g, "\n");
        this.header = this.showHeader ? "" : this.$game.headerText();
      } else {
        this.original = "";
        this.header = "";
      }
      this.ptn = this.original;
    },
  },
  watch: {
    ptn() {
      this.$emit("hasChanges", this.hasChanges);
    },
    showHeader() {
      this.init();
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
