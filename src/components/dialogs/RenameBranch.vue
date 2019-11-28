<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-backdrop-dismiss>
    <q-card style="width: 300px" class="bg-secondary">
      <q-card-section>
        <SmoothReflow>
          <q-input
            v-model="newBranch"
            @keydown.enter.prevent="save"
            :rules="[validateBranch]"
            color="accent"
            hide-bottom-space
            no-error-icon
            :autofocus="!Platform.is.mobile"
            clearable
            autogrow
            dense
          >
          </q-input>
        </SmoothReflow>
      </q-card-section>

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <q-btn :label="$t('Cancel')" color="accent" flat v-close-popup />
        <q-btn :label="$t('OK')" @click="save" color="accent" flat />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { Platform } from "quasar";

import Linenum from "../../PTN/Linenum";

export default {
  name: "RenameBranch",
  props: ["value", "game", "linenum"],
  data() {
    return {
      Platform,
      newBranch: ""
    };
  },
  computed: {
    branchParts() {
      return this.linenum.splitBranch;
    }
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
    validateBranch(value) {
      return (
        value === this.linenum.branch ||
        (Linenum.validateBranch(value) &&
          !Object.keys(this.game.branches).includes(value))
      );
    },
    save() {
      let branchParts = this.branchParts.concat();
      branchParts[branchParts.length - 1] = this.newBranch;
      this.game.renameBranch(this.linenum.branch, branchParts.join("/"));
      this.close();
    }
  },
  watch: {
    value(visible) {
      if (visible) {
        this.beforeEdit();
      }
    }
  }
};
</script>

<style></style>
