<template>
  <span
    class="ptn ply"
    :class="{ selected: isSelected, other: !isInBranch }"
    v-if="ply"
  >
    <q-chip
      @click.left="select(ply, isSelected ? !isDone : true)"
      @click.right.stop.prevent
      :color="ply.color === 1 ? 'player1' : 'player2'"
      :dark="theme[`player${ply.color}Dark`]"
      :outline="!isDone"
      :clickable="!noClick"
      :ripple="false"
      :key="ply.id"
      square
      dense
      v-on="$listeners"
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
        v-if="!noBranches && branches.length"
        @click.stop
        icon="arrow_drop_down"
        size="md"
        flat
        dense
      >
        <BranchMenu
          @select="selectBranch"
          v-if="branches.length"
          :branches="branches"
          v-model="menu"
        />
      </q-btn>
    </q-chip>
    <Result
      v-if="ply.result"
      :result="ply.result.text"
      :done="isDone"
      @click.left.prevent.native="select(ply, isSelected ? !isDone : true)"
      @click.right.prevent.native="select(ply, false)"
      clickable
    />

    <slot />
  </span>
</template>

<script>
import BranchMenu from "../controls/BranchMenu";
import Result from "./Result";

export default {
  name: "Ply",
  components: { BranchMenu, Result },
  props: {
    ply: Object,
    noBranches: Boolean,
    noClick: Boolean,
    done: Boolean,
  },
  data() {
    return {
      menu: false,
    };
  },
  computed: {
    theme() {
      return this.$store.state.ui.theme;
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    branches() {
      return this.ply.branches.map((id) => this.ptn.allPlies[id]);
    },
    isSelected() {
      return this.position.plyID === this.ply.id;
    },
    isInBranch() {
      return this.ptn.branchPlies.includes(this.ply);
    },
    isDone() {
      return (
        this.done ||
        (this.position.plyID === this.ply.id
          ? this.position.plyIsDone
          : this.isInBranch && this.position.plyIndex > this.ply.index)
      );
    },
  },
  methods: {
    select(ply, isDone = this.position.plyIsDone) {
      if (this.noClick) {
        return;
      }
      this.$store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone });
    },
    selectBranch(ply) {
      this.$store.dispatch("game/SET_TARGET", ply);
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
    &.bg-player1 {
      border-color: $player1;
      border-color: var(--q-color-player1);
    }
    &.bg-player2 {
      border-color: $player2;
      border-color: var(--q-color-player2);
    }
  }
  .ptn.ply.selected & {
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

      $blur: 0.5em;
      body.player1Dark & .ply.color1 .square,
      body.player2Dark & .ply.color2 .square {
        text-shadow: 0 0 $blur $textLight;
        text-shadow: 0 0 $blur var(--q-color-textLight);
      }
      body:not(.player1Dark) & .ply.color1 .square,
      body:not(.player2Dark) & .ply.color2 .square {
        text-shadow: 0 0 $blur $textDark;
        text-shadow: 0 0 $blur var(--q-color-textDark);
      }
    }
  }
}
</style>
