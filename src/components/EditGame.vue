<template>
  <q-dialog
    :value="value"
    @input="$emit('input', $event)"
    no-backdrop-dismiss
    no-route-dismiss
  >
    <q-card style="width: 500px" class="bg-secondary" dark>
      <q-card-section class="q-gutter-y-md column">
        <q-input
          v-model="name"
          :label="$t('Title')"
          @keyup.enter="save"
          color="accent"
          dark
          filled
        />

        <div class="row">
          <div class="col q-gutter-y-md">
            <q-input
              v-model="player1"
              :label="$t('Player1')"
              @keyup.enter="save"
              color="accent"
              dark
              filled
            >
              <template v-slot:prepend>
                <q-icon name="person" />
              </template>
            </q-input>

            <q-input
              v-model="player2"
              :label="$t('Player2')"
              @keyup.enter="save"
              color="accent"
              dark
              filled
            >
              <template v-slot:prepend>
                <q-icon name="person_outline" />
              </template>
            </q-input>
          </div>
          <q-btn @click="swapPlayers" icon="swap_vert" dense flat />
        </div>
      </q-card-section>
      <q-separator dark />
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
      name: "",
      player1: this.game.tag("player1"),
      player2: this.game.tag("player2")
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

      this.player1 = (this.player1 || "").trim();
      this.player2 = (this.player2 || "").trim();
      if (this.player1 !== this.game.tag("player1")) {
        this.game.setTag("player1", this.player1);
        this.player1 = this.game.tag("player1");
      }
      if (this.player2 !== this.game.tag("player2")) {
        this.game.setTag("player2", this.player2);
        this.player2 = this.game.tag("player2");
      }

      this.close();
    },
    swapPlayers() {
      const player1 = this.player1;
      this.player1 = this.player2;
      this.player2 = player1;
    }
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.name = this.game.name;
        this.player1 = this.game.tag("player1");
        this.player2 = this.game.tag("player2");
      }
    }
  }
};
</script>

<style></style>
