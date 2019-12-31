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
              <q-icon :name="$store.getters['online/gameIcon'](player)" />
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
      if (this.game.config.player !== 0) {
        let config = Object.assign(omit(this.game.config, "playerKey"), {
          player: 0
        });
        this.$store.dispatch("SET_CONFIG", { game: this.game, config });
      }

      this.close();
    },
    play() {
      if (this.playDisabled) {
        return;
      }

      // Remember player name
      if (this.validateName(this.playerName)) {
        this.$store.dispatch("SET_UI", ["playerName", this.playerName]);
      } else {
        return;
      }

      this.$store.dispatch("online/JOIN_GAME", {
        game: this.game,
        player: this.player,
        playerName: this.playerName
      });

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
