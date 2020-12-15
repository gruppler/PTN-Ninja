<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-backdrop-dismiss>
    <q-card style="width: 300px" class="bg-secondary">
      <q-input
        ref="input"
        v-model="newBranch"
        @keydown.enter.prevent="save"
        :rules="[validateBranch]"
        color="accent"
        hide-bottom-space
        clearable
        autofocus
        autogrow
        filled
        dense
      >
      </q-input>

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          :disabled="$refs.input && $refs.input.hasError"
          @click="save"
          color="accent"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import Linenum from "../../PTN/Linenum";

export default {
  name: "RenameBranch",
  props: ["value", "game", "linenum"],
  data() {
    return {
      newBranch: "",
    };
  },
  computed: {
    branchParts() {
      return this.linenum.splitBranch;
    },
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    beforeEdit() {
      this.newBranch = this.branchParts[this.branchParts.length - 1];
      this.$store.dispatch("SET_UI", ["editingBranch", this.linenum.branch]);
    },
    afterEdit() {
      this.$store.dispatch("SET_UI", ["editingBranch", ""]);
    },
    getFullBranch(value = this.newBranch) {
      return [
        ...this.branchParts.slice(0, this.branchParts.length - 1),
        value,
      ].join("/");
    },
    validateBranch(value) {
      return (
        value === this.linenum.branch ||
        (value &&
          Linenum.validateBranch(value) &&
          !Object.keys(this.game.branches).includes(this.getFullBranch(value)))
      );
    },
    save() {
      this.game.renameBranch(this.linenum.branch, this.getFullBranch());
      this.close();
    },
  },
  watch: {
    value(visible) {
      if (visible) {
        this.beforeEdit();
      } else {
        this.afterEdit();
      }
    },
  },
};
</script>
