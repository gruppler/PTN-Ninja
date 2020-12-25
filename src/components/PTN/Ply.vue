<template>
  <span class="ptn ply" v-if="ply">
    <q-chip
      @click.left="select(ply, isSelected ? !isDone : true)"
      @click.right.prevent.native="select(ply, !game.state.plyIsDone)"
      :class="{ selected: isSelected }"
      :color="ply.color === 1 ? 'player1' : 'player2'"
      :dark="theme[`player${ply.color}Dark`]"
      :outline="!isDone"
      :clickable="!noClick"
      v-ripple="false"
      :key="ply.id"
      square
      dense
    >
      <span class="ply" :class="'color' + ply.color">
        <span class="pieceCount" v-if="ply.minPieceCount">{{
          ply.minPieceCount
        }}</span>
        <span class="specialPiece" v-if="ply.specialPiece">{{
          ply.specialPiece
        }}</span>
        <span class="square">{{ ply.column + ply.row }}</span>
        <span class="direction" v-if="ply.direction">{{ ply.direction }}</span>
        <span class="distribution" v-if="ply.minDistribution">{{
          ply.minDistribution
        }}</span>
        <span class="wallSmash" v-if="ply.wallSmash">{{ ply.wallSmash }}</span>
        <span class="evaluation" v-if="ply.evaluation">{{
          ply.evaluation.text
        }}</span>
      </span>
      <q-btn
        v-if="!noBranches && ply.branches.length"
        @click.stop
        icon="arrow_drop_down"
        size="md"
        flat
        dense
      >
        <BranchMenu
          @select="selectBranch"
          v-if="ply.branches.length"
          :game="game"
          :branches="ply.branches"
          v-model="menu"
        />
      </q-btn>
    </q-chip>
    <Result
      :result="ply.result"
      :done="isDone"
      @click.left.prevent.native="select(ply, isSelected ? !isDone : true)"
      @click.right.prevent.native="select(ply, !game.state.plyIsDone)"
      clickable
    />
  </span>
</template>

<script>
import BranchMenu from "../controls/BranchMenu";
import Result from "./Result";

export default {
  name: "Ply",
  components: { BranchMenu, Result },
  props: {
    game: Object,
    plyID: Number,
    noBranches: Boolean,
    noClick: Boolean,
  },
  data() {
    return {
      menu: false,
    };
  },
  computed: {
    theme() {
      return this.$store.state.theme;
    },
    ply() {
      return this.game.plies[this.plyID];
    },
    isSelected() {
      return this.game ? this.game.state.plyID === this.ply.id : false;
    },
    isDone() {
      return this.game && this.ply
        ? this.game.state.plyID === this.ply.id
          ? this.game.state.plyIsDone
          : this.game.state.plyIDs.includes(this.ply.id) &&
            this.game.state.ply.index > this.ply.index
        : true;
    },
  },
  methods: {
    select(ply, isDone = this.game.state.plyIsDone) {
      if (this.noClick) {
        return;
      }
      this.game.goToPly(ply.id, isDone);
    },
    selectBranch(ply) {
      this.game.setTarget(ply);
    },
  },
};
</script>

<style lang="scss">
.ptn.ply {
  display: inline-flex;
  vertical-align: middle;
  flex-direction: row;
  align-items: center;
}

.q-chip {
  font-size: inherit;
  &:not(.q-chip--outline) {
    border: 1px solid;
    &.bg-player2 {
      border-color: $player2;
      border-color: var(--q-color-player2);
    }
    &.bg-player1 {
      border-color: $player1;
      border-color: var(--q-color-player1);
    }
  }
  &.selected {
    box-shadow: 0 0 0 2px $primary;
    box-shadow: 0 0 0 2px var(--q-color-primary);
    body.desktop &.q-chip--clickable:focus {
      box-shadow: $shadow-1, 0 0 0 2px $primary;
      box-shadow: $shadow-1, 0 0 0 2px var(--q-color-primary);
    }
  }
  .q-btn {
    margin-right: -0.7em;
  }
}

.ply {
  font-family: "Source Code Pro";
  font-weight: bold;

  .q-chip {
    .pieceCount {
      color: $blue-dark;
    }
    .specialPiece {
      color: $orange-dark;
    }
    .direction {
      color: $blue-dark;
    }
    .distribution {
      color: $green-dark;
    }
    .wallSmash {
      color: $orange-dark;
    }
    .evaluation {
      color: $orange-dark;
    }
    &.q-dark {
      .pieceCount {
        color: $blue-light;
      }
      .specialPiece {
        color: $orange-light;
      }
      .direction {
        color: $blue-light;
      }
      .distribution {
        color: $green-light;
      }
      .wallSmash {
        color: $orange-light;
      }
      .evaluation {
        color: $orange-light;
      }
    }

    &.q-chip--outline {
      .pieceCount {
        color: $blue-dark;
      }
      .specialPiece {
        color: $orange-dark;
      }
      .direction {
        color: $blue-dark;
      }
      .distribution {
        color: $green-dark;
      }
      .wallSmash {
        color: $orange-dark;
      }
      .evaluation {
        color: $orange-dark;
      }
      body.panelDark & {
        .pieceCount {
          color: $blue-light;
        }
        .specialPiece {
          color: $orange-light;
        }
        .direction {
          color: $blue-light;
        }
        .distribution {
          color: $green-light;
        }
        .wallSmash {
          color: $orange-light;
        }
        .evaluation {
          color: $orange-light;
        }
      }
    }
  }
}
</style>
