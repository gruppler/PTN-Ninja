<template>
  <div>
    <q-expansion-item
      v-model="expanded"
      header-class="bg-accent"
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
              {{ $t("analysis.noSavedResults") }}
            </q-item>
          </div>
        </smooth-reflow>
      </recess>
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
      this.$store.dispatch("analysis/SELECT_SAVED_ENGINE", this.botName);
    },
    switchToNextSavedBotIfNeeded() {
      // If this bot was the active saved bot, sync to next available
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

      // Switch to next bot if this was the active one
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
