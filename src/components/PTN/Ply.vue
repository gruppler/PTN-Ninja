<template>
  <span
    class="ptn ply"
    :class="{ selected: isSelected, other: !isInBranch }"
    v-if="ply"
    :data-ply-id="ply.id"
    :data-tps-after="tpsAfterValue || undefined"
    :data-tps="tps || undefined"
    :data-plies="pliesJson || undefined"
    :data-ply-text="ply.text"
    :data-note="userNoteHtml || undefined"
  >
    <q-chip
      @click="select(ply, isSelected ? !isDone : true)"
      :color="ply.color === 1 ? 'player1' : 'player2'"
      :dark="theme[`player${ply.color}Dark`]"
      :outline="!isDone"
      :clickable="!noClick"
      v-ripple="false"
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
        <span class="evaluation" v-if="displayEvaluation">{{
          displayEvaluation
        }}</span>

        <slot />
      </span>
      <q-btn
        v-if="!noBranches && showBranchButton"
        @click.stop="handleBranchButton"
        :icon="
          inlineBranches
            ? isCollapsed
              ? 'arrow_drop_down'
              : 'arrow_drop_up'
            : 'arrow_drop_down'
        "
        size="md"
        flat
        dense
      >
        <BranchMenu
          v-if="!inlineBranches && hasBranches"
          @select="selectBranch"
          :branches="branches"
          v-model="menu"
        />
      </q-btn>
      <q-badge v-if="hasUserNotes" class="note-badge" floating />
    </q-chip>
    <Result
      v-if="ply.result"
      :result="ply.result.text"
      :done="isDone"
      @click.left.prevent.native="select(ply, isSelected ? !isDone : true)"
      @click.right.prevent.native="select(ply, false)"
      clickable
    />
  </span>
</template>

<script>
import BranchMenu from "../controls/BranchMenu";
import Result from "./Result";

import { isBoolean } from "lodash";
import { USER_NOTE_PREFIX } from "../../Game/PTN/Comment";
import inlineMarkdown from "../../utils/inlineMarkdown";

export default {
  name: "Ply",
  components: { BranchMenu, Result },
  inject: {
    branchUI: {
      default: null,
    },
  },
  props: {
    ply: Object,
    inlineBranches: Boolean,
    noBranches: Boolean,
    noClick: Boolean,
    tpsAfter: {
      type: String,
      default: null,
    },
    tps: {
      type: String,
      default: null,
    },
    plies: {
      type: Array,
      default: null,
    },
    done: {
      type: Boolean,
      default: null,
    },
    selected: {
      type: Boolean,
      default: null,
    },
  },
  data() {
    return {
      menu: false,
    };
  },
  computed: {
    tpsAfterValue() {
      return this.tpsAfter || this.ply.tpsAfter;
    },
    pliesJson() {
      return this.plies ? JSON.stringify(this.plies) : null;
    },
    theme() {
      return this.$store.state.ui.theme;
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    position() {
      return this.$store.state.game.position;
    },
    ptn() {
      return this.$store.state.game.ptn;
    },
    branches() {
      return Object.freeze(
        this.ply.branches.map((id) => this.ptn.allPlies[id])
      );
    },
    hasBranches() {
      return Boolean(
        this.ply && this.ply.branches && this.ply.branches.length > 1
      );
    },
    isBranchParent() {
      if (!this.hasBranches) {
        return false;
      }
      const first =
        this.branches && this.branches.length ? this.branches[0] : null;
      return Boolean(first && first.id === this.ply.id);
    },
    showBranchButton() {
      if (!this.hasBranches) {
        return false;
      }
      return this.inlineBranches ? this.isBranchParent : true;
    },
    useBranchMenu() {
      return !this.inlineBranches;
    },
    isCollapsed() {
      if (!this.inlineBranches) {
        return false;
      }
      if (!this.branchUI || !this.branchUI.isExpanded) {
        return true;
      }
      return !this.branchUI.isExpanded(this.ply);
    },
    isSelected() {
      return isBoolean(this.selected)
        ? this.selected
        : this.position.plyID === this.ply.id;
    },
    branchPlyIDs() {
      const plies = this.ptn.branchPlies;
      const ids = new Set();
      for (let i = 0; i < plies.length; i++) {
        ids.add(plies[i].id);
      }
      return ids;
    },
    isInBranch() {
      return this.branchPlyIDs.has(this.ply.id);
    },
    isDone() {
      return isBoolean(this.done)
        ? this.done
        : this.position.plyID === this.ply.id
        ? this.position.plyIsDone
        : this.isInBranch && this.position.plyIndex > this.ply.index;
    },
    userNotes() {
      const allNotes = this.$store.state.game.comments.notes;
      const notes = allNotes[this.ply.id];
      if (!notes) return [];
      return notes.filter(
        (n) => n.evaluation === null && n.pv === null && n.pvAfter === null
      );
    },
    hasUserNotes() {
      return this.userNotes.length > 0;
    },
    userNoteText() {
      return this.userNotes
        .map((n) =>
          n.message.startsWith(USER_NOTE_PREFIX)
            ? n.message.slice(USER_NOTE_PREFIX.length)
            : n.message
        )
        .join("\n");
    },
    userNoteHtml() {
      if (!this.hasUserNotes) return null;
      return inlineMarkdown(this.userNoteText);
    },
    displayEvaluation() {
      if (!this.ply) return null;

      const analysis = this.$store.state.analysis;
      const showEvalMarks = analysis?.showEvalMarks;

      // Get the base evaluation text from ply (tak/tinue marks and manual eval marks)
      const plyEval = this.ply.evaluation;
      const takTinue = plyEval
        ? (plyEval.tinue ? '"' : "") + (plyEval.tak ? "'" : "")
        : "";

      // Check for dynamic eval mark override from bot analysis or saved results
      if (showEvalMarks) {
        const getOverride = this.$store.getters["analysis/getEvalMarkOverride"];
        const override = getOverride ? getOverride(this.ply) : null;
        if (override) {
          return override + takTinue;
        }
      }

      // Always show manual eval marks from PTN
      if (plyEval && (plyEval["?"] || plyEval["!"])) {
        return plyEval.text;
      }

      return takTinue || null;
    },
  },
  methods: {
    select(ply, isDone = this.position.plyIsDone) {
      if (this.noClick || this.$store.state.ui.disableNavigation) {
        return;
      }
      this.$store.dispatch("game/GO_TO_PLY", { plyID: ply.id, isDone });
    },
    selectBranch(ply) {
      if (!this.$store.state.ui.disableNavigation) {
        this.$store.dispatch("game/SET_TARGET", ply);
      }
    },
    handleBranchButton() {
      if (this.inlineBranches) {
        this.toggleCollapse();
      }
    },
    toggleCollapse() {
      if (!this.branchUI || !this.branchUI.toggle) {
        return;
      }
      this.branchUI.toggle(this.ply);
    },
    captureFocus(event) {
      console.log(event);
    },
  },
  watch: {
    menu(isOpen) {
      this.$store.commit("ui/SET_BRANCH_MENU_OPEN", isOpen);
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
      border-color: var(--q-color-player1);
    }
    &.bg-player2 {
      border-color: var(--q-color-player2);
    }
  }
  .ptn.ply.selected & {
    box-shadow: 0 0 0 2px var(--q-color-primary);
    body.desktop &.q-chip--clickable:focus {
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

  .note-badge {
    top: -3px;
  }

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
        text-shadow: 0 0 $blur var(--q-color-textLight);
      }
      body:not(.player1Dark) & .ply.color1 .square,
      body:not(.player2Dark) & .ply.color2 .square {
        text-shadow: 0 0 $blur var(--q-color-textDark);
      }
    }
  }
}
</style>
