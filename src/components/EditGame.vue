<template>
  <q-dialog :value="value" @input="$emit('input', $event)" no-backdrop-dismiss>
    <q-card style="width: 500px" class="bg-secondary text-accent" dark>
      <q-card-section>
        <q-input
          v-model="name"
          @keyup.enter="save"
          color="accent"
          dark
          clearable
          dense
          filled
          autofocus
        />
      </q-card-section>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('OK')" @click="save" flat />
        <q-btn :label="$t('Cancel')" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "EditGame",
  props: ["value", "game"],
  data() {
    return {
      name: ""
    };
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    save() {
      this.name = (this.name || "").trim();
      if (this.game.name !== this.name) {
        if (!this.name) {
          this.name = this.game.generateName();
        }
        this.name = this.$store.getters.uniqueName(this.name, true);
        this.game.name = this.name;
      }
      this.close();
    }
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.name = this.game.name;
      }
    }
  }
};
</script>

<style></style>
