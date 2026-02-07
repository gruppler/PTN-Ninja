<template>
  <q-expansion-item
    v-model="expanded"
    header-class="bg-ui"
    expand-icon-class="fg-inherit"
  >
    <template v-slot:header>
      <q-item-section avatar>
        <q-btn
          @click.stop="selectSavedBot"
          :color="isActiveSavedBot ? 'primary' : ''"
          style="margin-left: -4px"
          dense
          round
          flat
          glossy
          :disable="!savedSuggestions.length"
        >
          <q-icon :name="botIcon" />
          <hint>{{ $t("Select Saved Results") }}</hint>
        </q-btn>
      </q-item-section>
      <q-item-section :class="{ 'text-primary': isActiveSavedBot }">
        <q-item-label>{{ botLabel }}</q-item-label>
      </q-item-section>
      <q-item-section class="fg-inherit" side>
        <q-btn
          @click.stop
          icon="delete"
          :disable="!savedSuggestions.length"
          dense
          round
          flat
        >
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item
                clickable
                @click="clearCurrentPositionSavedResults"
                :disable="!savedSuggestions.length"
              >
                <q-item-section avatar>
                  <q-icon name="delete" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ $t("analysis.Delete Positions Saved Results") }}
                  </q-item-label>
                </q-item-section>
              </q-item>

              <q-item
                clickable
                @click="clearAllSavedResults"
                :disable="!hasAnySavedResults"
              >
                <q-item-section avatar>
                  <q-icon name="delete_all" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>
                    {{ $t("analysis.Delete Engines Saved Results") }}
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-item-section>
    </template>

    <recess>
      <smooth-reflow height-only style="overflow-x: hidden">
        <BotAnalysisItem
          v-for="(suggestion, i) in savedSuggestions"
          :key="'saved-' + i"
          :suggestion="suggestion"
          :prev-suggestion="i > 0 ? savedSuggestions[i - 1] : null"
          show-menu
          :fixed-height="!showFullPVs"
          :show-continuation="showContinuation"
          expandable
          @delete="deleteSavedSuggestion(suggestion)"
        />
        <!-- Fill remaining space with placeholders when fewer than average -->
        <AnalysisItemPlaceholder
          v-for="i in fillerPlaceholderCount"
          :key="'saved-filler-placeholder-' + i"
          :show-continuation="showContinuation"
          static
        />
        <div v-if="!savedSuggestions.length" class="relative-position">
          <AnalysisItemPlaceholder
            v-for="i in modeResultsCount"
            :key="'static-placeholder-' + i"
            :show-continuation="showContinuation"
            static
          />
          <q-item
            class="flex-center absolute-center full-width"
            :class="'text-' + textColor"
          >
            {{ $t("analysis.noResults") }}
          </q-item>
        </div>
      </smooth-reflow>
    </recess>
  </q-expansion-item>
</template>

<script>
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import AnalysisItemPlaceholder from "../analysis/AnalysisItemPlaceholder";
import { bots } from "../../bots";

export default {
  name: "SavedBotResults",
  components: {
    BotAnalysisItem,
    AnalysisItemPlaceholder,
  },
  props: {
    botName: {
      type: String,
      default: null,
    },
    index: {
      type: Number,
      required: true,
    },
  },
  computed: {
    expanded: {
      get() {
        return (
          this.$store.state.analysis.collapsedSavedBots?.[this.index] !== true
        );
      },
      set(value) {
        this.$store.dispatch("analysis/SET_SAVED_BOT_COLLAPSED", {
          index: this.index,
          collapsed: !value,
        });
      },
    },
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    game() {
      return this.$store.state.game;
    },
    tps() {
      return this.game.position.tps;
    },
    botIcon() {
      if (!this.botName) {
        return "bot";
      }
      // Try to find the bot by name in the bots registry
      for (const [id, bot] of Object.entries(bots)) {
        if (bot.label === this.botName || bot.meta?.name === this.botName) {
          return bot.icon || "bot";
        }
      }
      return "bot";
    },
    preferSavedResults() {
      return this.$store.state.analysis?.preferSavedResults ?? true;
    },
    savedBotName() {
      return this.$store.state.analysis?.savedBotName;
    },
    isActiveSavedBot() {
      // This bot's saved results are active if:
      // 1. preferSavedResults is true
      // 2. savedBotName matches this bot's name (null matches null for "Other")
      if (!this.preferSavedResults) return false;
      return this.savedBotName === this.botName;
    },
    botLabel() {
      return this.botName || this.$t("Other");
    },
    allSavedSuggestions() {
      return this.$store.getters["game/suggestions"](this.tps);
    },
    savedSuggestions() {
      // Filter to only suggestions matching this bot's name
      if (this.botName === null) {
        // "Other" section: suggestions without a bot name
        return this.allSavedSuggestions.filter((s) => !s.botName);
      }
      return this.allSavedSuggestions.filter((s) => s.botName === this.botName);
    },
    hasAnySavedResults() {
      // Check if there are any saved results for this bot across all positions
      const allPlies = this.game.ptn && this.game.ptn.allPlies;
      if (!allPlies) return this.savedSuggestions.length > 0;

      // Check initial position
      const firstPly = allPlies[0];
      if (firstPly && firstPly.tpsBefore) {
        const suggestions = this.$store.getters["game/suggestions"](
          firstPly.tpsBefore
        );
        const filtered =
          this.botName === null
            ? suggestions.filter((s) => !s.botName)
            : suggestions.filter((s) => s.botName === this.botName);
        if (filtered.length > 0) return true;
      }

      // Check all positions
      for (const ply of allPlies) {
        if (!ply || !ply.tpsAfter) continue;
        const suggestions = this.$store.getters["game/suggestions"](
          ply.tpsAfter
        );
        const filtered =
          this.botName === null
            ? suggestions.filter((s) => !s.botName)
            : suggestions.filter((s) => s.botName === this.botName);
        if (filtered.length > 0) return true;
      }
      return false;
    },
    modeResultsCount() {
      // Find the mode of saved results for this bot across positions
      const allPlies = this.game.ptn && this.game.ptn.allPlies;
      if (!allPlies) return 1;
      const counts = {};
      const seenTps = new Set();

      const countForTps = (tps) => {
        if (!tps || seenTps.has(tps)) return;
        seenTps.add(tps);
        const suggestions = this.$store.getters["game/suggestions"](tps);
        const filtered =
          this.botName === null
            ? suggestions.filter((s) => !s.botName)
            : suggestions.filter((s) => s.botName === this.botName);
        if (filtered.length > 0) {
          counts[filtered.length] = (counts[filtered.length] || 0) + 1;
        }
      };

      // Include initial position
      const firstPly = allPlies[0];
      if (firstPly && firstPly.tpsBefore) {
        countForTps(firstPly.tpsBefore);
      }

      for (const ply of allPlies) {
        if (ply) countForTps(ply.tpsAfter);
      }

      let mode = 1;
      let maxFreq = 0;
      for (const [value, freq] of Object.entries(counts)) {
        if (freq > maxFreq) {
          maxFreq = freq;
          mode = parseInt(value, 10);
        }
      }
      return Math.max(1, mode);
    },
    fillerPlaceholderCount() {
      if (!this.savedSuggestions.length) return 0;
      return Math.max(0, this.modeResultsCount - this.savedSuggestions.length);
    },
    showFullPVs() {
      return this.$store.state.analysis.showFullPVs;
    },
    showContinuation() {
      return this.$store.state.analysis.showContinuation;
    },
  },
  methods: {
    selectSavedBot() {
      // Set this bot's name as the saved bot and enable preferSavedResults
      this.$store.dispatch("analysis/SET", ["savedBotName", this.botName]);
      this.$store.dispatch("analysis/SET", ["preferSavedResults", true]);
    },
    getNextSavedBotName() {
      // Find the next bot name that has saved results (excluding current bot)
      const allPlies = this.game.ptn && this.game.ptn.allPlies;
      if (!allPlies) return null;

      const botNames = new Set();
      const collectBotNames = (tps) => {
        if (!tps) return;
        const suggestions = this.$store.getters["game/suggestions"](tps);
        for (const s of suggestions) {
          if (s.botName !== this.botName) {
            botNames.add(s.botName);
          }
        }
      };

      // Check initial position
      if (allPlies[0] && allPlies[0].tpsBefore) {
        collectBotNames(allPlies[0].tpsBefore);
      }
      // Check all positions
      for (const ply of allPlies) {
        if (ply) collectBotNames(ply.tpsAfter);
      }

      // Return first available bot name (prefer named bots over null/"Other")
      const namedBots = [...botNames].filter((name) => name !== null);
      if (namedBots.length > 0) {
        return namedBots.sort((a, b) => a.localeCompare(b))[0];
      }
      if (botNames.has(null)) {
        return null;
      }
      return undefined; // No saved results from any bot
    },
    switchToNextSavedBotIfNeeded() {
      // If this bot was the active saved bot, switch to next available
      if (this.isActiveSavedBot) {
        const nextBot = this.getNextSavedBotName();
        if (nextBot !== undefined) {
          this.$store.dispatch("analysis/SET", ["savedBotName", nextBot]);
        } else {
          // No more saved results - switch to engine analysis
          this.$store.dispatch("analysis/SET", ["preferSavedResults", false]);
        }
      }
    },
    deleteSavedSuggestion(suggestion) {
      if (!suggestion.source) {
        return;
      }
      this.$store.dispatch("game/REMOVE_ANALYSIS_NOTE", suggestion.source);
      this.notifyUndo({
        icon: "delete",
        message: this.$t("success.resultsDeleted"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    clearCurrentPositionSavedResults() {
      // Remove only this bot's saved results for current position
      if (this.savedSuggestions.length === 0) return;

      // Use the batch action that creates a single undo entry
      this.$store.dispatch("game/REMOVE_POSITION_BOT_ANALYSIS_NOTES", {
        tps: this.tps,
        botName: this.botName,
      });

      this.notifyUndo({
        icon: "delete",
        message: this.$t("success.resultsDeleted"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    clearAllSavedResults() {
      // Remove all saved results for this bot across all positions
      if (!this.hasAnySavedResults) return;

      // Get next bot before deleting (while we still have data)
      const nextBot = this.getNextSavedBotName();
      const wasActive = this.isActiveSavedBot;

      // Use the batch action that creates a single undo entry
      this.$store.dispatch("game/REMOVE_BOT_ANALYSIS_NOTES", this.botName);

      // Switch to next bot if this was the active one
      if (wasActive) {
        if (nextBot !== undefined) {
          this.$store.dispatch("analysis/SET", ["savedBotName", nextBot]);
        } else {
          this.$store.dispatch("analysis/SET", ["preferSavedResults", false]);
        }
      }

      this.notifyUndo({
        icon: "delete_all",
        message: this.$t("success.resultsDeleted"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
  },
};
</script>
