<template>
  <div>
    <recess>
      <!-- Bot Suggestions -->
      <div
        v-for="(botId, index) in activeBots"
        :key="'bot-' + (botId || index)"
      >
        <q-separator v-if="index > 0" :dark="dark" />
        <BotSuggestions
          :bot-id="botId"
          :index="index"
          :is-last-bot="activeBots.length === 1"
          :is-first="index === 0"
          :is-last="index === activeBots.length - 1"
          :auto-open-settings="autoOpenSettingsIndex === index"
          @select="onBotSelect"
          @remove="onBotRemove"
          @move-up="onBotMoveUp"
          @move-down="onBotMoveDown"
          @auto-open-consumed="onAutoOpenConsumed"
        />
      </div>

      <q-separator :dark="dark" />

      <!-- Add Bot Button -->
      <q-btn
        @click="addBot"
        icon="add"
        :label="$t('Add Engine')"
        class="full-width no-border-radius"
        color="primary"
      />

      <q-separator :dark="dark" />
    </recess>
  </div>
</template>

<script>
import BotSuggestions from "./BotSuggestions.vue";
import { bots } from "../../bots";

export default {
  name: "BotAnalysis",
  components: {
    BotSuggestions,
  },
  data() {
    return {
      autoOpenSettingsIndex: null,
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    activeBots() {
      return this.$store.state.analysis.activeBots;
    },
    defaultBotID() {
      return this.$store.state.analysis.botID;
    },
  },
  methods: {
    addBot() {
      this.$store.dispatch("analysis/ADD_ACTIVE_BOT", null);
    },
    onBotSelect({ index, botId }) {
      const wasEmpty = !this.activeBots[index];
      this.$store.dispatch("analysis/SET_ACTIVE_BOT", { index, botId });
      // Auto-open settings for newly added TEI so user can configure it
      if (wasEmpty && botId === "tei") {
        this.autoOpenSettingsIndex = index;
      }
    },
    onAutoOpenConsumed(index) {
      if (this.autoOpenSettingsIndex === index) {
        this.autoOpenSettingsIndex = null;
      }
    },
    onBotRemove(index) {
      const removedBotId = this.activeBots[index];
      const bot = bots[removedBotId];
      const botName = bot ? bot.label : removedBotId;
      this.$store.dispatch("analysis/REMOVE_ACTIVE_BOT", index);
      this.notifyUndo({
        icon: "bot_off",
        message: botName
          ? this.$t("success.removedEngineX", { engineName: botName })
          : this.$t("success.removedEngine"),
        handler: () => {
          this.$store.dispatch("analysis/INSERT_ACTIVE_BOT", {
            index,
            botId: removedBotId,
          });
        },
      });
    },
    onBotMoveUp(index) {
      if (index > 0) {
        this.$store.dispatch("analysis/REORDER_ACTIVE_BOTS", {
          fromIndex: index,
          toIndex: index - 1,
        });
      }
    },
    onBotMoveDown(index) {
      if (index < this.activeBots.length - 1) {
        this.$store.dispatch("analysis/REORDER_ACTIVE_BOTS", {
          fromIndex: index,
          toIndex: index + 1,
        });
      }
    },
  },
  mounted() {
    // Initialize with default bot if empty
    if (this.activeBots.length === 0) {
      this.$store.dispatch("analysis/ADD_ACTIVE_BOT", this.defaultBotID);
    }
  },
};
</script>
