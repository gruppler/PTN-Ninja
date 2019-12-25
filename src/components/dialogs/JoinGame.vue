<template>
  <q-dialog :value="value" @input="$emit('input', $event)" persistent>
    <q-card style="width: 300px" class="bg-secondary">
      <q-card-section>
        <SmoothReflow>
          <q-input
            ref="input"
            v-model="playerName"
            :label="$t('Player Name')"
            :rules="[validateName]"
            :autofocus="!playerName.length"
            @keydown.enter.prevent="play"
            color="accent"
            hide-bottom-space
            clearable
          >
            <template v-slot:prepend>
              <q-icon :name="$store.getters['online/icon'](player)" />
            </template>
          </q-input>
        </SmoothReflow>
      </q-card-section>

      <q-card-actions class="row items-center justify-end q-gutter-sm">
        <q-btn :label="$t('Spectate')" @click="spectate" color="accent" flat />
        <q-btn
          :label="$t('Play')"
          :disabled="playDisabled"
          @click="play"
          color="accent"
          flat
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { formats } from "../../PTN/Tag";

import { omit } from "lodash";

export default {
  name: "JoinGame",
  props: ["value", "game"],
  data() {
    return {
      playerName: this.$store.state.playerName,
      validateName: value => formats.player1.test(value)
    };
  },
  computed: {
    player() {
      return this.game.openPlayer;
    },
    playDisabled() {
      return (
        !this.player || !this.playerName || !this.validateName(this.playerName)
      );
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
    },
    spectate() {
      if (this.game.options.player !== 0) {
        let options = Object.assign(omit(this.game.options, "playerKey"), {
          player: 0
        });
        this.$store.dispatch("SAVE_OPTIONS", { game: this.game, options });
      }

      this.close();
    },
    play() {
      if (this.playDisabled) {
        return;
      }

      this.$store.dispatch("SET_UI", ["playerName", this.playerName]);

      if (this.game.options.player !== this.player) {
        let options = Object.assign(omit(this.game.options, "playerKey"), {
          player: this.player
        });
        this.$store.dispatch("SAVE_OPTIONS", { game: this.game, options });
      }

      if (this.game.tag("player" + this.player) !== this.playerName) {
        this.game.setTags(
          { ["player" + this.player]: this.playerName },
          false,
          false
        );
        this.$store.dispatch("UPDATE_PTN", this.game.text());
        this.game.name = this.game.generateName();
      }

      this.close();
    }
  },
  watch: {
    value(visible) {
      if (visible) {
        this.playerName = this.$store.state.playerName;
      }
    }
  }
};
</script>
