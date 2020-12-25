<template>
  <span class="ptn linenum">
    <span
      v-if="showBranch"
      class="branch"
      :class="{ selected: isSelected, only: onlyBranch }"
      @click.left="selectBranch(ply)"
    >
      {{ this.branch }}
      <q-menu v-if="!noEdit" context-menu auto-close>
        <q-list class="bg-ui">
          <q-item @click="renameBranch" clickable>
            <q-item-section side>
              <q-icon name="edit" />
            </q-item-section>
            <q-item-section>{{ $t("Rename") }}</q-item-section>
          </q-item>
          <q-item @click="deleteBranch" clickable>
            <q-item-section side>
              <q-icon name="delete" />
            </q-item-section>
            <q-item-section>{{ $t("Delete") }}</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
      <q-btn
        v-if="onlyBranch"
        @click.stop
        icon="arrow_drop_down"
        size="md"
        flat
        dense
      >
        <BranchMenu
          @select="selectBranch"
          :game="game"
          :branches="branches"
          linenum
          v-model="menu"
        />
      </q-btn>
    </span>
    <span class="number" v-if="!onlyBranch"
      >{{ this.linenum.number }}.&nbsp;</span
    >

    <RenameBranch v-model="dialogRename" :game="game" :linenum="linenum" />
  </span>
</template>

<script>
import BranchMenu from "../controls/BranchMenu";
import RenameBranch from "../dialogs/RenameBranch";

export default {
  name: "Linenum",
  components: { BranchMenu, RenameBranch },
  props: {
    linenum: Object,
    game: Object,
    noEdit: Boolean,
    noBranch: Boolean,
    onlyBranch: Boolean,
  },
  data() {
    return {
      menu: false,
      dialogRename: false,
      newBranch: "",
    };
  },
  computed: {
    branch() {
      return this.linenum.branch.replace(/_/g, " ").replace(/-/g, "‑");
    },
    ply() {
      return this.game.branches[this.linenum.branch];
    },
    branches() {
      return this.ply.branches;
    },
    showBranch() {
      return !this.noBranch && this.linenum.branch;
    },
    isSelected() {
      const ply1 = this.linenum.move.ply1;
      const ply2 = this.linenum.move.ply2;
      return (
        this.showBranch &&
        this.game.state.targetBranch &&
        ((ply1 &&
          ply1.branches &&
          ply1.branches.length &&
          ply1.branches[0] !== ply1 &&
          this.game.state.plyIDs.includes(ply1.id)) ||
          (ply2 &&
            ply2.branches &&
            ply2.branches.length &&
            ply2.branches[0] !== ply2 &&
            this.game.state.plyIDs.includes(ply2.id)))
      );
    },
  },
  methods: {
    selectBranch(ply) {
      this.game.setTarget(ply);
    },
    renameBranch() {
      this.dialogRename = true;
    },
    deleteBranch() {
      this.game.deleteBranch(this.linenum.branch);
    },
  },
};
</script>

<style lang="scss">
.linenum {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  vertical-align: middle;
  color: $fg-dark;
  body.panelDark:not(.panelMedium) & {
    color: $fg-light;
  }
  .branch {
    word-break: break-word;
    font-weight: bold;
    font-size: 0.9em;
    line-height: 1.3em;
    padding: 4px;
    margin: 0;
    max-width: 270px;
    border-radius: $generic-border-radius;
    cursor: pointer;
    background-color: $highlight;
    &.selected {
      background-color: $primary;
      background-color: var(--q-color-primary);
    }
    &.only {
      margin-top: 0.25em;
      margin-bottom: 0.25em;
    }
    .q-btn {
      margin: -0.5em -0.25em;
    }

    + .number {
      margin-left: 0.5em;
    }
  }
  .number {
    font-size: 0.9em;
    line-height: 2.2em;
  }
}
</style>
