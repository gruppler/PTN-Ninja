<template>
  <q-dialog
    ref="dialog"
    :value="model"
    @show="init"
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
        <template v-slot:append>
          <q-icon
            @click="clipboard"
            name="clipboard"
            class="q-field__focusable-action"
          />
        </template>
      </q-input>

      <q-card-actions align="right">
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          :disabled="$refs.input && $refs.input.hasError"
          :loading="loading"
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
      loading: false,
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
    async clipboard() {
      try {
        this.gameID = await this.$store.dispatch("ui/PASTE");
      } catch (error) {
        console.error(error);
      }
    },
    load() {
      this.loading = true;
      this.$store
        .dispatch("game/ADD_PLAYTAK_GAME", { id: this.gameID })
        .then(() => {
          this.$emit("submit");
          this.close();
        })
        .finally(() => {
          this.loading = false;
        });
    },
    async init() {
      try {
        const text = await this.$store.dispatch("ui/PASTE");
        if (this.validateGameID(text)) {
          this.gameID = text;
        }
      } catch (error) {
        console.error(error);
      }
    },
  },
};
</script>
