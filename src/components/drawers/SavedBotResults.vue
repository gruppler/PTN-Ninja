<template>
  <div>
    <q-expansion-item
      v-model="expanded"
      header-class="bg-accent sticky-header shadow-2"
      class="saved-bot-results"
      expand-icon-class="fg-inherit"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-btn
            @click.stop="selectSavedBot"
            :color="isActiveSavedBot ? 'primary' : ''"
            :text-color="
              $store.state.ui.theme.accentDark ? 'textLight' : 'textDark'
            "
            style="margin-left: -4px"
            dense
            round
            glossy
          >
            <q-icon :name="botIcon" />
            <hint>{{ $t("Select Saved Results") }}</hint>
          </q-btn>
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ botLabel }}</q-item-label>
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <div class="row no-wrap q-gutter-x-sm">
            <q-btn
              @click.stop
              icon="delete"
              :disable="!hasAnySavedResults"
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
          </div>
        </q-item-section>
      </template>

      <smooth-reflow height-only style="overflow-x: hidden">
        <BotAnalysisItem
          v-for="(suggestion, i) in displayedSuggestions"
          :key="'saved-' + i"
          :suggestion="suggestion"
          :prev-suggestion="i > 0 ? displayedSuggestions[i - 1] : null"
          show-menu
          :fixed-height="!showFullPVs"
          :engine-key="suggestionEngineKey"
          :pv-index="i"
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
            v-for="i in emptyPlaceholderCount"
            :key="'static-placeholder-' + i"
            :show-continuation="showContinuation"
            static
          />
          <q-item
            class="flex-center absolute-center full-width"
            :class="'text-' + textColor"
          >
            {{ $t("analysis.noSavedResults") }}
          </q-item>
        </div>
      </smooth-reflow>
    </q-expansion-item>
  </div>
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
        // Use bot name as key for collapsed state (synced with BotSuggestions)
        // Use empty string for null bot names (the "Other" section)
        const key = this.botName != null ? this.botName : "";
        return this.$store.state.analysis.collapsedBots?.[key] !== true;
      },
      set(value) {
        this.$store.dispatch("analysis/SET_BOT_COLLAPSED", {
          botName: this.botName,
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
        return "engine";
      }
      // Try to find the bot by name in the bots registry
      for (const [id, bot] of Object.entries(bots)) {
        if (bot.label === this.botName || bot.meta?.name === this.botName) {
          return bot.icon || "engine";
        }
      }
      return "engine";
    },
    preferSavedResults() {
      return this.$store.state.analysis?.preferSavedResults ?? true;
    },
    savedBotName() {
      return this.$store.state.analysis?.savedBotName;
    },
    isActiveSavedBot() {
      // This bot's saved results are active if:
      // 1. analysisSource is "saved"
      // 2. preferSavedResults is true
      // 3. savedBotName matches this bot's name (null matches null for "Other")
      if (this.$store.state.analysis.analysisSource !== "saved") return false;
      if (!this.preferSavedResults) return false;
      return this.savedBotName === this.botName;
    },
    botLabel() {
      return this.botName || this.$t("Other");
    },
    suggestionEngineKey() {
      return this.botName != null ? this.botName : "";
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
    displayedSuggestions() {
      return this.savedSuggestions.slice(0, 8);
    },
    botID() {
      // Resolve the bot ID from the bot name
      if (!this.botName) return null;
      for (const [id, bot] of Object.entries(bots)) {
        if (bot.label === this.botName || bot.meta?.name === this.botName) {
          return id;
        }
      }
      return null;
    },
    hasAnySavedResults() {
      // Check notes directly instead of iterating all plies
      const notes = this.game.comments && this.game.comments.notes;
      if (!notes) return this.savedSuggestions.length > 0;
      for (const id in notes) {
        for (const note of notes[id]) {
          if (
            note.evaluation !== null ||
            note.pv !== null ||
            note.pvAfter !== null
          ) {
            const noteName = note.botName !== undefined ? note.botName : null;
            if (this.botName === null ? !noteName : noteName === this.botName) {
              return true;
            }
          }
        }
      }
      return false;
    },
    modeResultsCount() {
      // Find the mode of saved results for this bot across positions
      // Use tpsNoteIndex to only check TPS values that have notes
      const { afterIndex } = this.$store.getters["game/tpsNoteIndex"];
      const getSuggestions = this.$store.getters["game/suggestions"];
      const counts = {};
      const seenTps = new Set();

      const countForTps = (tps) => {
        if (!tps || seenTps.has(tps)) return;
        seenTps.add(tps);
        const suggestions = getSuggestions(tps);
        const filtered =
          this.botName === null
            ? suggestions.filter((s) => !s.botName)
            : suggestions.filter((s) => s.botName === this.botName);
        if (filtered.length > 0) {
          counts[filtered.length] = (counts[filtered.length] || 0) + 1;
        }
      };

      // Only iterate TPS values that actually have notes
      for (const tps in afterIndex) {
        countForTps(tps);
      }
      // Also check initial position
      const allPlies = this.game.ptn && this.game.ptn.allPlies;
      if (allPlies && allPlies[0] && allPlies[0].tpsBefore) {
        countForTps(allPlies[0].tpsBefore);
      }

      let mode = 1;
      let maxFreq = 0;
      for (const [value, freq] of Object.entries(counts)) {
        if (freq > maxFreq) {
          maxFreq = freq;
          mode = parseInt(value, 10);
        }
      }
      return Math.min(8, Math.max(1, mode));
    },
    engineModeResultsCount() {
      // Fall back to the engine's live unsaved results to size placeholders,
      // matching the Engines tab behavior
      if (!this.botID) return 1;
      const positions = this.$store.state.analysis.botPositions[this.botID];
      if (positions) {
        const positionArrays = Object.values(positions).filter(
          (arr) => arr.length > 0
        );
        if (positionArrays.length) {
          const counts = {};
          for (const arr of positionArrays) {
            counts[arr.length] = (counts[arr.length] || 0) + 1;
          }
          let mode = 1;
          let maxFreq = 0;
          for (const [value, freq] of Object.entries(counts)) {
            if (freq > maxFreq) {
              maxFreq = freq;
              mode = parseInt(value, 10);
            }
          }
          return Math.min(8, Math.max(1, mode));
        }
      }
      // Check multiPV from bot settings/meta
      const optionSources = [
        this.$store.state.analysis.botSettings[this.botID]?.options,
      ];
      const bot = bots[this.botID];
      if (bot) {
        optionSources.push(bot.settings?.options);
      }
      for (const options of optionSources) {
        if (options) {
          for (const [key, value] of Object.entries(options)) {
            if (key.toLowerCase() === "multipv") {
              const numValue = Number(value);
              if (!isNaN(numValue) && numValue > 0) {
                return Math.min(8, Math.max(1, numValue));
              }
            }
          }
        }
      }
      const metaOptionSources = [
        this.$store.state.analysis.customBots[this.botID]?.meta?.presetOptions,
        this.$store.state.analysis.botMetas[this.botID]?.presetOptions,
        this.$store.state.analysis.botMetas[this.botID]?.options,
      ];
      if (bot) {
        metaOptionSources.push(bot.meta?.presetOptions, bot.meta?.options);
      }
      for (const options of metaOptionSources) {
        if (options) {
          for (const [key, option] of Object.entries(options)) {
            if (key.toLowerCase() === "multipv") {
              const val = option?.value ?? option?.default;
              const numValue = Number(val);
              if (!isNaN(numValue) && numValue > 0) {
                return Math.min(8, Math.max(1, numValue));
              }
            }
          }
        }
      }
      return 1;
    },
    fillerPlaceholderCount() {
      if (!this.savedSuggestions.length) return 0;
      return Math.max(
        0,
        this.modeResultsCount - this.displayedSuggestions.length
      );
    },
    emptyPlaceholderCount() {
      // For engines without saved results, use engine results count if available
      return this.hasAnySavedResults
        ? this.modeResultsCount
        : this.engineModeResultsCount;
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
      this.$store.dispatch("analysis/SELECT_SAVED_ENGINE", this.botName);
    },
    switchToNextSavedBotIfNeeded() {
      if (this.isActiveSavedBot) {
        this.$store.dispatch("analysis/SYNC_SAVED_ENGINE");
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

      const wasActive = this.isActiveSavedBot;

      // Use the batch action that creates a single undo entry
      this.$store.dispatch("game/REMOVE_BOT_ANALYSIS_NOTES", this.botName);

      if (wasActive) {
        this.$store.dispatch("analysis/SYNC_SAVED_ENGINE");
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

<style lang="scss">
.saved-bot-results {
  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 2;
  }
}
</style>
