<template>
  <div
    class="piece-selector row no-wrap"
    v-shortkey="hotkeys"
    @shortkey="hotkey($event.srcKey)"
  >
    <q-btn
      @click="select(type, color === 1 ? 2 : 1)"
      :icon="$store.getters['ui/playerIcon'](color)"
      flat
      round
    />

    <q-btn @click="select('F')" :disabled="!available.includes('F')" flat round>
      <div class="square" :class="{ selected: type === 'F' }">
        <div class="stone" :class="{ ['p' + color]: true }" />
      </div>
    </q-btn>

    <q-btn @click="select('S')" :disabled="!available.includes('S')" flat round>
      <div class="square" :class="{ selected: type === 'S' }">
        <div class="stone S" :class="{ ['p' + color]: true }" />
      </div>
    </q-btn>

    <q-btn @click="select('C')" :disabled="!available.includes('C')" flat round>
      <div class="square" :class="{ selected: type === 'C' }">
        <div class="stone C" :class="{ ['p' + color]: true }" />
      </div>
    </q-btn>

    <q-input
      type="number"
      v-model="firstMoveNumber"
      :label="$t('Move')"
      :min="minFirstMoveNumber"
      :max="999"
      filled
      dense
    />

    <q-btn :label="$t('Cancel')" @click="resetTPS" color="primary" flat />

    <q-btn :label="$t('OK')" @click="saveTPS" color="primary" flat />
  </div>
</template>

<script>
import { HOTKEYS } from "../../keymap";

export default {
  name: "PieceSelector",
  data() {
    return {
      color: 1,
      type: "F",
      hotkeys: HOTKEYS.PIECE,
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    available() {
      return ["F", "S", "C"].filter((type) => {
        type = type === "C" ? "cap" : "flat";
        return this.game.board.piecesRemaining[this.color][type] > 0;
      });
    },
    selectedPiece: {
      get() {
        return this.$store.state.ui.selectedPiece;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["selectedPiece", value]);
        this.editingTPS = this.$game.board._getTPS(
          this.selectedPiece.color,
          this.firstMoveNumber
        );
      },
    },
    minFirstMoveNumber() {
      const min1 = this.$store.state.game.board.piecesPlayed[1].total;
      const min2 = this.$store.state.game.board.piecesPlayed[2].total;
      return Math.max(min1, min2) + 1 * (min1 <= min2);
    },
    firstMoveNumber: {
      get() {
        return this.$store.state.ui.firstMoveNumber;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["firstMoveNumber", 1 * value]);
        this.editingTPS = this.$game.board._getTPS(
          this.selectedPiece.color,
          this.firstMoveNumber
        );
      },
    },
    editingTPS: {
      get() {
        return this.$store.state.game.editingTPS;
      },
      set(tps) {
        this.$store.dispatch("game/EDIT_TPS", tps);
      },
    },
  },
  methods: {
    select(type = this.type, color = this.color) {
      this.color = color;
      if (this.available.includes(type)) {
        this.type = type;
        this.selectedPiece = { color: this.color, type: this.type };
      } else if (type === this.type && this.available.length) {
        this.type = this.available[0];
        this.selectedPiece = { color: this.color, type: this.type };
      }
    },
    hotkey(key) {
      if (key === "color") {
        this.select(this.type, this.color === 1 ? 2 : 1);
      } else {
        this.select(key);
      }
    },
    resetTPS() {
      this.$store.dispatch("game/RESET_TPS");
    },
    saveTPS() {
      this.$store.dispatch("game/SAVE_TPS", this.editingTPS);
    },
  },
  watch: {
    available(available) {
      if (available.length && !available.includes(this.type)) {
        this.type = available[0];
        this.selectedPiece = { color: this.color, type: this.type };
      }
    },
    selectedPiece(selected) {
      this.color = selected.color;
      this.type = selected.type || "F";
    },
    editingTPS() {
      if (this.firstMoveNumber < this.minFirstMoveNumber) {
        this.firstMoveNumber = this.minFirstMoveNumber;
      }
    },
  },
};
</script>

<style lang="scss">
.piece-selector {
  .square {
    width: 2.25em;
    height: 2.25em;
    background: $board1;
    background: var(--q-color-board1);
    position: relative;
    border-radius: 3px;
    &.selected {
      background: $primary;
      background: var(--q-color-primary);
    }
  }

  .stone {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 50%;
    height: 50%;
    margin: 25%;
    box-sizing: border-box;
    border-width: $piece-border-width;
    border-width: var(--piece-border-width);
    border-style: solid;
    border-radius: 10%;
    box-shadow: $shadow-1;

    &.p1 {
      background-color: $player1flat;
      background-color: var(--q-color-player1flat);
      border-color: $player1border;
      border-color: var(--q-color-player1border);
    }
    &.p2 {
      background-color: $player2flat;
      background-color: var(--q-color-player2flat);
      border-color: $player2border;
      border-color: var(--q-color-player2border);
    }

    &.S {
      width: 18.75%;
      left: 15%;
      border-radius: 27%/10%;

      &.p1 {
        background-color: $player1special;
        background-color: var(--q-color-player1special);
        transform: rotate(-45deg);
        box-shadow: -1px 1px 2px rgba(#000, 0.3);
      }
      &.p2 {
        background-color: $player2special;
        background-color: var(--q-color-player2special);
        transform: rotate(45deg);
        box-shadow: 1px 1px 2px rgba(#000, 0.3);
      }
    }
    &.C {
      border-radius: 50%;
      &.p1 {
        background-color: $player1special;
        background-color: var(--q-color-player1special);
      }
      &.p2 {
        background-color: $player2special;
        background-color: var(--q-color-player2special);
      }
    }
  }
}
</style>
