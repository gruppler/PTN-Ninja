<template>
  <span class="q-gutter-xs">
    <span v-for="bot in savedBots" :key="bot.name || 'other'">
      <q-icon :name="bot.icon" :color="bot.isActive ? 'primary' : ''">
        <tooltip>
          {{ bot.label }}:
          {{ $tc("analysis.n_positions", bot.positionCount) }}
        </tooltip>
      </q-icon>
      <span
        class="text-caption"
        style="font-size: 0.7em; vertical-align: super"
      >
        {{ bot.positionCount }}
      </span>
    </span>
  </span>
</template>

<script>
import { bots } from "../../bots";

export default {
  name: "SavedFilterIcons",
  computed: {
    savedBotNames() {
      return this.$store.getters["analysis/savedBotNames"];
    },
    preferSavedResults() {
      return this.$store.state.analysis?.preferSavedResults ?? true;
    },
    activeSavedBotName() {
      return this.$store.state.analysis?.savedBotName;
    },
    notes() {
      const game = this.$store.state.game;
      return game && game.comments && game.comments.notes;
    },
    savedBots() {
      const notes = this.notes;
      return this.savedBotNames.map((name) => {
        let positionCount = 0;
        if (notes) {
          const seen = new Set();
          for (const plyID in notes) {
            for (const note of notes[plyID]) {
              if (
                note.evaluation !== null ||
                note.pv !== null ||
                note.pvAfter !== null
              ) {
                const noteName =
                  note.botName !== undefined ? note.botName : null;
                if (name === null ? !noteName : noteName === name) {
                  if (!seen.has(plyID)) {
                    seen.add(plyID);
                    positionCount++;
                  }
                }
              }
            }
          }
        }
        return {
          name,
          icon: this.botIcon(name),
          label: name || this.$t("Other"),
          isActive: this.preferSavedResults && this.activeSavedBotName === name,
          positionCount,
        };
      });
    },
  },
  methods: {
    botIcon(name) {
      if (!name) return "engine";
      for (const [, bot] of Object.entries(bots)) {
        if (bot.label === name || bot.meta?.name === name) {
          return bot.icon || "engine";
        }
      }
      return "engine";
    },
  },
};
</script>
