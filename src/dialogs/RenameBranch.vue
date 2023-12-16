<template>
  <q-dialog
    ref="dialog"
    :value="true"
    @hide="hide"
    no-backdrop-dismiss
    no-route-dismiss
  >
    <q-card style="width: 300px">
      <q-input
        ref="input"
        v-model="newBranch"
        @keydown.enter.prevent
        @keyup.enter.prevent="save"
        :rules="[validateBranch]"
        hide-bottom-space
        clearable
        autofocus
        autogrow
        filled
      >
      </q-input>

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          :disabled="$refs.input && $refs.input.hasError"
          @click="save"
          color="primary"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import Linenum from "../Game/PTN/Linenum";

export default {
  name: "RenameBranch",
  props: {
    branch: String,
    goBack: Boolean,
  },
  data() {
    return {
      newBranch: "",
    };
  },
  computed: {
    branchParts() {
      return Linenum.splitBranch(this.branch);
    },
  },
  methods: {
    hide() {
      if (this.goBack) {
        this.$router.back();
      }
    },
    close() {
      this.$refs.dialog.hide();
    },
    beforeEdit() {
      this.newBranch = this.branchParts[this.branchParts.length - 1];
      this.$store.dispatch("ui/SET_UI", ["editingBranch", this.branch]);
    },
    afterEdit() {
      this.$store.dispatch("ui/SET_UI", ["editingBranch", ""]);
    },
    getFullBranch(value = this.newBranch) {
      return [
        ...this.branchParts.slice(0, this.branchParts.length - 1),
        value,
      ].join("/");
    },
    validateBranch(value) {
      return (
        value === this.branch ||
        (value &&
          Linenum.validateBranch(value) &&
          !Object.keys(this.$game.branches).includes(this.getFullBranch(value)))
      );
    },
    save() {
      this.$store.dispatch("game/RENAME_BRANCH", {
        oldName: this.branch,
        newName: this.getFullBranch(),
      });
      this.close();
    },
  },
  mounted() {
    this.beforeEdit();
  },
  beforeDestroy() {
    this.afterEdit();
  },
};
</script>
