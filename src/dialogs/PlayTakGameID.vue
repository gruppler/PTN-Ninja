<template>
  <q-dialog
    ref="dialog"
    :value="model"
    @hide="hide"
    no-backdrop-dismiss
    no-route-dismiss
  >
    <q-card style="width: 300px">
      <q-input
        ref="input"
        v-model="gameID"
        @keyup.enter.capture.prevent="load"
        :label="$t('PlayTak Game ID')"
        :rules="[validateGameID]"
        hide-bottom-space
        clearable
        autofocus
        filled
      >
      </q-input>

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          :disabled="$refs.input && $refs.input.hasError"
          @click="load"
          color="primary"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
export default {
  name: "PlayTakGameID",
  props: {
    value: Boolean,
    goBack: Boolean,
  },
  data() {
    return {
      gameID: "",
    };
  },
  computed: {
    model() {
      return this.value;
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
    validateGameID(value) {
      return /^\d+$/.test(value);
    },
    load() {
      this.$store.dispatch("game/ADD_PLAYTAK_GAME", this.gameID).then(() => {
        this.$emit("submit");
        this.close();
      });
    },
  },
};
</script>
