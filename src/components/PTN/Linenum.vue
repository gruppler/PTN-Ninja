<template>
  <span class="ptn linenum">
    <span
      v-if="showBranch"
      class="branch"
      :class="{ selected: isSelected, only: onlyBranch }"
      @click.left="selectBranch(ply)"
    >
      {{ this.branch }}
      <q-popup-edit
        v-model="newBranch"
        content-class="bg-secondary"
        :disable="noEdit"
        :validate="validateBranch"
        context-menu
        @before-show="beforeEdit"
        @save="renameBranch"
        @hide="afterEdit"
        anchor="bottom middle"
        self="top left"
      >
        <template v-slot="{ value, emitValue, set, cancel, validate }">
          <q-input
            v-model="newBranch"
            class="items-end"
            @input="emitValue"
            @keydown.enter.prevent="set"
            :rules="[validateBranch]"
            color="accent"
            hide-bottom-space
            no-error-icon
            :autofocus="!Platform.is.mobile"
            autogrow
            dense
          >
            <template v-slot:before>
              <q-btn
                icon="check"
                @click.stop="set"
                :disable="validate(value) === false"
                dense
                flat
              />
            </template>
            <template v-slot:after>
              <q-btn icon="delete" @click.stop="deleteBranch" dense flat />
              <q-btn icon="close" @click.stop="cancel" dense flat />
            </template>
          </q-input>
        </template>
      </q-popup-edit>
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
  </span>
</template>

<script>
import { Platform } from "quasar";

import BranchMenu from "../controls/BranchMenu";
import Linenum from "../../PTN/Linenum";

export default {
  name: "Linenum",
  components: { BranchMenu },
  props: {
    linenum: Object,
    game: Object,
    noEdit: Boolean,
    noBranch: Boolean,
    onlyBranch: Boolean
  },
  data() {
    return {
      Platform,
      menu: false,
      newBranch: ""
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
      return (
        !this.noBranch &&
        this.linenum.branch &&
        this.$store.state.showAllBranches
      );
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
    branchParts() {
      return this.linenum.splitBranch;
    }
  },
  methods: {
    beforeEdit() {
      this.newBranch = this.branchParts[this.branchParts.length - 1];
      this.$store.dispatch("SET_UI", ["editingBranch", this.linenum.branch]);
    },
    afterEdit() {
      this.$nextTick(() => {
        this.$store.dispatch("SET_UI", ["editingBranch", ""]);
      });
    },
    validateBranch(value) {
      return (
        value === this.linenum.branch ||
        (Linenum.validateBranch(value) &&
          !Object.keys(this.game.branches).includes(value))
      );
    },
    renameBranch() {
      let branchParts = this.branchParts.concat();
      branchParts[branchParts.length - 1] = this.newBranch;
      this.game.renameBranch(this.linenum.branch, branchParts.join("/"));
    },
    deleteBranch() {
      this.game.deleteBranch(this.linenum.branch);
    },
    selectBranch(ply) {
      this.game.setTarget(ply);
    }
  }
};
</script>

<style lang="stylus">
.linenum
  display inline-flex
  flex-direction row
  align-items center
  vertical-align middle
  .branch
    font-size 0.9em
    line-height 1.3em
    padding 4px
    margin 0 4px 0 -4px
    max-width 270px
    border-radius $generic-border-radius
    cursor pointer
    &.selected
      background-color $highlight
    &.only
      margin-top 0.25em
    .q-btn
      margin -0.5em -0.25em
  .number
    font-size 0.9em
    font-weight bold
</style>
