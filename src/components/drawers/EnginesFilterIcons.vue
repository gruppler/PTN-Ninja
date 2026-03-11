<template>
  <span class="q-gutter-xs">
    <span v-for="bot in botsWithResults" :key="bot.id" class="inline-block">
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
  name: "EnginesFilterIcons",
  computed: {
    activeBots() {
      return this.$store.state.analysis.activeBots || [];
    },
    botPositions() {
      return this.$store.state.analysis.botPositions;
    },
    gameTpsSet() {
      return this.$store.getters["game/gameTpsSet"];
    },
    preferSavedResults() {
      return this.$store.state.analysis?.preferSavedResults ?? true;
    },
    activeBotID() {
      return this.$store.state.analysis.botID;
    },
    botsWithResults() {
      const gameTps = this.gameTpsSet;
      const result = [];
      for (const botId of this.activeBots) {
        if (!botId) continue;
        const positions = this.botPositions[botId];
        if (!positions) continue;
        let positionCount = 0;
        for (const tps of Object.keys(positions)) {
          if (gameTps.has(tps)) positionCount++;
        }
        if (positionCount > 0) {
          const bot = bots[botId];
          const listOption = bot ? bot.listOption : {};
          result.push({
            id: botId,
            icon: listOption.icon || "engine",
            label: listOption.label || botId,
            isActive: !this.preferSavedResults && botId === this.activeBotID,
            positionCount,
          });
        }
      }
      return result;
    },
  },
};
</script>
