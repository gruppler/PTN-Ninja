<template>
  <q-expansion-item
    v-model="sections.savedResults"
    header-class="bg-accent"
    expand-icon-class="fg-inherit"
    default-opened
  >
    <template v-slot:header>
      <q-item-section avatar>
        <q-icon name="save" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ $t("Saved Results") }}</q-item-label>
      </q-item-section>
      <q-item-section class="fg-inherit" side>
        <q-btn
          @click.stop="toggleSettings"
          icon="settings"
          :color="showSettings ? 'primary' : ''"
          round
          dense
          flat
        >
          <hint>{{ $t("Settings") }}</hint>
        </q-btn>
      </q-item-section>
      <q-item-section class="fg-inherit" side> </q-item-section>
    </template>

    <recess>
      <!-- Settings -->
      <smooth-reflow>
        <div v-if="showSettings" :class="'text-' + textColor">
          <!-- Show Continuation -->
          <q-item
            @click="showContinuationToggle = !showContinuationToggle"
            clickable
            v-ripple
          >
            <q-item-section>
              <q-item-label>{{ $t("analysis.showContinuation") }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="showContinuationToggle" :dark="dark" />
            </q-item-section>
          </q-item>

          <!-- Show Full Suggestion -->
          <smooth-reflow>
            <q-item
              v-if="showContinuationToggle"
              @click="showFullPVsToggle = !showFullPVsToggle"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.showFullSuggestion")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="showFullPVsToggle" :dark="dark" />
              </q-item-section>
            </q-item>
          </smooth-reflow>
        </div>
      </smooth-reflow>

      <smooth-reflow height-only style="overflow-x: hidden">
        <BotAnalysisItem
          v-for="(suggestion, i) in savedSuggestions"
          :key="'saved-' + i"
          :suggestion="suggestion"
          :prev-suggestion="i > 0 ? savedSuggestions[i - 1] : null"
          show-bot-name
          show-menu
          :fixed-height="!showFullPVs"
          :show-continuation="showContinuation"
          expandable
          @delete="deleteSavedSuggestion(suggestion)"
        />
        <!-- Fill remaining space with placeholders when fewer than average -->
        <AnalysisItemPlaceholder
          v-for="i in savedFillerPlaceholderCount"
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
import { cloneDeep } from "lodash";

export default {
  name: "SavedResults",
  components: {
    BotAnalysisItem,
    AnalysisItemPlaceholder,
  },
  data() {
    return {
      sections: cloneDeep(this.$store.state.ui.analysisSections),
      showSettings: false,
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    activeBots() {
      return this.$store.state.analysis.activeBots;
    },
    game() {
      return this.$store.state.game;
    },
    tps() {
      return this.game.position.tps;
    },
    savedSuggestions() {
      return this.$store.getters["game/suggestions"](this.tps);
    },
    hasAnalysisNotes() {
      return Object.values(this.$store.state.game.comments.notes).some(
        (notes) =>
          notes.some(
            (note) =>
              note.evaluation !== null ||
              note.pv !== null ||
              note.pvAfter !== null
          )
      );
    },
    hasCurrentPositionSavedResults() {
      return this.savedSuggestions.length > 0;
    },
    hasEvalMarks() {
      const plies = this.game.ptn && this.game.ptn.allPlies;
      if (!plies) return false;
      return plies.some(
        (ply) =>
          ply && ply.evaluation && (ply.evaluation["?"] || ply.evaluation["!"])
      );
    },
    modeResultsCount() {
      // Find the mode (most repeated number) of saved results across positions with results
      const allPlies = this.game.ptn && this.game.ptn.allPlies;
      if (!allPlies) return 1;
      const counts = {};
      const seenTps = new Set();

      // Include initial position (before first ply)
      const firstPly = allPlies[0];
      if (firstPly && firstPly.tpsBefore) {
        seenTps.add(firstPly.tpsBefore);
        const suggestions = this.$store.getters["game/suggestions"](
          firstPly.tpsBefore
        );
        if (suggestions.length > 0) {
          counts[suggestions.length] = (counts[suggestions.length] || 0) + 1;
        }
      }

      for (const ply of allPlies) {
        if (!ply) continue;
        // Check tpsAfter for each ply
        if (ply.tpsAfter && !seenTps.has(ply.tpsAfter)) {
          seenTps.add(ply.tpsAfter);
          const suggestions = this.$store.getters["game/suggestions"](
            ply.tpsAfter
          );
          if (suggestions.length > 0) {
            counts[suggestions.length] = (counts[suggestions.length] || 0) + 1;
          }
        }
      }
      // Find the mode (value with highest frequency)
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
    savedFillerPlaceholderCount() {
      // Number of placeholders to fill remaining space when fewer saved suggestions than mode
      if (!this.savedSuggestions.length) return 0;
      return Math.max(0, this.modeResultsCount - this.savedSuggestions.length);
    },
    showFullPVs() {
      return this.$store.state.analysis.showFullPVs;
    },
    showFullPVsToggle: {
      get() {
        return this.$store.state.analysis.showFullPVs;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showFullPVs", value]);
      },
    },
    showContinuation() {
      return this.$store.state.analysis.showContinuation;
    },
    showContinuationToggle: {
      get() {
        return this.$store.state.analysis.showContinuation;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showContinuation", value]);
      },
    },
  },
  methods: {
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
    toggleSettings() {
      this.showSettings = !this.showSettings;
      if (this.showSettings) {
        this.sections.savedResults = true;
      }
    },
  },
  watch: {
    "sections.savedResults"(value) {
      const storeValue = this.$store.state.ui.analysisSections;
      if (storeValue.savedResults !== value) {
        this.$store.dispatch("ui/SET_UI", [
          "analysisSections",
          { ...storeValue, savedResults: value },
        ]);
      }
    },
    "$store.state.ui.analysisSections.savedResults"(value) {
      if (this.sections.savedResults !== value) {
        this.sections.savedResults = value;
      }
    },
  },
};
</script>
