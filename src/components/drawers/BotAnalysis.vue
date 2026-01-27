<template>
  <div>
    <q-expansion-item
      v-model="sections.botSuggestions"
      header-class="bg-accent"
      expand-icon-class="fg-inherit"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <BotProgress
            v-if="!sections.botSuggestions && runningBotState"
            :is-running="true"
            :interactive="runningBotState.isInteractiveEnabled"
            :progress="runningBotState.progress"
            class="no-pointer-events"
            dense
            flat
          />
          <q-icon v-else name="bot" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("analysis.Engine Moves") }}</q-item-label>
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <q-btn
            @click.stop="showGlobalSettings = !showGlobalSettings"
            icon="settings"
            :color="showGlobalSettings ? 'primary' : ''"
            round
            dense
            flat
          >
            <hint>{{ $t("Settings") }}</hint>
          </q-btn>
        </q-item-section>
      </template>

      <recess>
        <!-- Global Settings -->
        <smooth-reflow>
          <div v-if="showGlobalSettings">
            <!-- Show Continuation -->
            <q-item
              @click="showContinuationToggle = !showContinuationToggle"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.showContinuation")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showContinuationToggle"
                  :dark="$store.state.ui.theme.panelDark"
                />
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
                  <q-toggle
                    v-model="showFullPVsToggle"
                    :dark="$store.state.ui.theme.panelDark"
                  />
                </q-item-section>
              </q-item>
            </smooth-reflow>

            <q-separator />

            <!-- Suggestions to Save -->
            <q-input
              type="number"
              v-model.number="pvsToSave"
              :label="$t('analysis.pvsToSave')"
              :min="1"
              :max="20"
              item-aligned
              filled
              :dark="$store.state.ui.theme.panelDark"
            />

            <!-- Plies to Save -->
            <q-input
              type="number"
              v-model.number="pvLimit"
              :label="$t('analysis.pliesToSave')"
              :min="0"
              :max="20"
              item-aligned
              filled
              :dark="$store.state.ui.theme.panelDark"
            />

            <!-- Save Extra Info -->
            <q-item
              tag="label"
              :class="[
                $store.state.ui.theme.panelDark
                  ? 'text-textLight'
                  : 'text-textDark',
              ]"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.saveSearchStats")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="saveSearchStats"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- Auto-save after Search -->
            <q-item
              @click="autoSaveAfterSearch = !autoSaveAfterSearch"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.autoSaveAfterSearch")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="autoSaveAfterSearch"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- Overwrite Inferior Results -->
            <q-item
              @click="overwriteInferior = !overwriteInferior"
              clickable
              v-ripple
            >
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.overwriteInferior")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="overwriteInferior"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <q-separator />

            <!-- Show Evaluation Marks -->
            <q-item @click="showEvalMarks = !showEvalMarks" clickable v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("analysis.showEvalMarks") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="showEvalMarks"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- Save Evaluation Marks -->
            <q-item @click="saveEvalMarks = !saveEvalMarks" clickable v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("analysis.saveEvalMarks") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="saveEvalMarks"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- Evaluation Mark Thresholds -->
            <smooth-reflow>
              <template v-if="saveEvalMarks || showEvalMarks">
                <q-item-label
                  :class="[
                    $store.state.ui.theme.panelDark
                      ? 'text-textLight'
                      : 'text-textDark',
                  ]"
                  header
                  >{{ $t("analysis.evalMarkThresholds") }}</q-item-label
                >
                <q-input
                  type="number"
                  v-model.number="evalMarkThresholds.brilliant"
                  :label="$t('analysis.thresholds.brilliant')"
                  :step="0.01"
                  :min="0.01"
                  hide-bottom-space
                  :dark="$store.state.ui.theme.panelDark"
                  filled
                  item-aligned
                />
                <q-input
                  type="number"
                  v-model.number="evalMarkThresholds.good"
                  :label="$t('analysis.thresholds.good')"
                  :step="0.01"
                  :min="0.01"
                  hide-bottom-space
                  :dark="$store.state.ui.theme.panelDark"
                  filled
                  item-aligned
                />
                <q-input
                  type="number"
                  v-model.number="evalMarkThresholds.bad"
                  :label="$t('analysis.thresholds.bad')"
                  :step="0.01"
                  :max="-0.01"
                  hide-bottom-space
                  :dark="$store.state.ui.theme.panelDark"
                  filled
                  item-aligned
                />
                <q-input
                  type="number"
                  v-model.number="evalMarkThresholds.blunder"
                  :label="$t('analysis.thresholds.blunder')"
                  :step="0.01"
                  :max="-0.01"
                  hide-bottom-space
                  :dark="$store.state.ui.theme.panelDark"
                  filled
                  item-aligned
                />
              </template>
            </smooth-reflow>
          </div>
        </smooth-reflow>

        <!-- Bot Suggestions -->
        <div
          v-for="(botId, index) in activeBots"
          :key="'bot-' + (botId || index)"
        >
          <q-separator v-if="index > 0" />
          <BotSuggestions
            :bot-id="botId"
            :index="index"
            :is-last-bot="activeBots.length === 1"
            :is-first="index === 0"
            :is-last="index === activeBots.length - 1"
            @select="onBotSelect"
            @remove="onBotRemove"
            @move-up="onBotMoveUp"
            @move-down="onBotMoveDown"
          />
        </div>

        <q-separator />

        <!-- Add Bot Button -->
        <q-btn
          @click="addBot"
          icon="add"
          :label="$t('Add Engine')"
          class="full-width no-border-radius"
          color="primary"
        />

        <q-separator />
      </recess>
    </q-expansion-item>

    <!-- Saved Results - moved outside Bot Analysis -->
    <q-expansion-item
      v-model="sections.savedResults"
      header-class="bg-accent"
      expand-icon-class="fg-inherit"
      default-opened
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-btn
            @click.stop="selectSavedResults"
            icon="save"
            :color="isActive ? 'primary' : ''"
            style="margin-left: -4px"
            dense
            round
            flat
          >
            <hint>{{ $t("Select Saved Results") }}</hint>
          </q-btn>
        </q-item-section>
        <q-item-section :class="{ 'text-primary': isActive }">
          <q-item-label>{{ $t("Saved Results") }}</q-item-label>
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <q-btn
            @click.stop
            icon="delete"
            :disable="!hasAnalysisNotes"
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
                  :disable="!hasCurrentPositionSavedResults"
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
                  @click="clearSavedResults"
                  :disable="!hasAnalysisNotes"
                >
                  <q-item-section avatar>
                    <q-icon name="delete_all" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>
                      {{ $t("analysis.Delete All Saved Results") }}
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-separator />

                <q-item
                  clickable
                  @click="removeEvalMarks"
                  :disable="!hasEvalMarks"
                >
                  <q-item-section avatar>
                    <q-icon name="eval" />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>
                      {{ $t("analysis.Remove Eval Marks") }}
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
            show-bot-name
            show-menu
            :fixed-height="!showFullPVs"
            :show-continuation="showContinuationToggle"
            expandable
            @delete="deleteSavedSuggestion(suggestion)"
          />
          <!-- Fill remaining space with placeholders when fewer than average -->
          <AnalysisItemPlaceholder
            v-for="i in savedFillerPlaceholderCount"
            :key="'saved-filler-placeholder-' + i"
            :show-continuation="showContinuationToggle"
            static
          />
          <div v-if="!savedSuggestions.length" class="relative-position">
            <AnalysisItemPlaceholder
              v-for="i in modeResultsCount"
              :key="'static-placeholder-' + i"
              :show-continuation="showContinuationToggle"
              static
            />
            <q-item
              class="flex-center absolute-center full-width"
              :class="[
                $store.state.ui.theme.panelDark
                  ? 'text-textLight'
                  : 'text-textDark',
              ]"
            >
              {{ $t("analysis.noResults") }}
            </q-item>
          </div>
        </smooth-reflow>
      </recess>
    </q-expansion-item>
  </div>
</template>

<script>
import BotSuggestions from "./BotSuggestions.vue";
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import AnalysisItemPlaceholder from "../analysis/AnalysisItemPlaceholder";
import BotProgress from "../analysis/BotProgress";
import { bots } from "../../bots";
import { cloneDeep, isEqual } from "lodash";

export default {
  name: "BotAnalysis",
  components: {
    BotSuggestions,
    BotAnalysisItem,
    AnalysisItemPlaceholder,
    BotProgress,
  },
  data() {
    return {
      sections: cloneDeep(this.$store.state.ui.analysisSections),
      localEvalMarkThresholds: cloneDeep(
        this.$store.state.analysis.evalMarkThresholds
      ),
      showGlobalSettings: false,
    };
  },
  computed: {
    activeBots() {
      return this.$store.state.analysis.activeBots;
    },
    defaultBotID() {
      return this.$store.state.analysis.botID;
    },
    game() {
      return this.$store.state.game;
    },
    tps() {
      return this.game.position.tps;
    },
    allPlies() {
      return this.game.ptn.allPlies;
    },
    isAnyBotRunning() {
      return this.runningBotState !== null;
    },
    runningBotState() {
      // Priority: selected toolbar bot if running, else first running bot
      const toolbarBotId = this.$store.state.analysis.botID;
      if (toolbarBotId && this.activeBots.includes(toolbarBotId)) {
        const state = this.$store.state.analysis.botStates[toolbarBotId];
        if (state && state.isRunning) {
          return state;
        }
      }
      // Find first running bot
      for (const botId of this.activeBots) {
        if (!botId) continue;
        const state = this.$store.state.analysis.botStates[botId];
        if (state && state.isRunning) {
          return state;
        }
      }
      return null;
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
    saveEvalMarks: {
      get() {
        return this.$store.state.analysis.saveEvalMarks;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["saveEvalMarks", value]);
      },
    },
    showEvalMarks: {
      get() {
        return this.$store.state.analysis.showEvalMarks;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["showEvalMarks", value]);
      },
    },
    evalMarkThresholds: {
      get() {
        return this.localEvalMarkThresholds;
      },
      set(value) {
        this.localEvalMarkThresholds = value;
      },
    },
    saveSearchStats: {
      get() {
        return this.$store.state.analysis.saveSearchStats;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["saveSearchStats", value]);
      },
    },
    pvLimit: {
      get() {
        return this.$store.state.analysis.pvLimit;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["pvLimit", value]);
      },
    },
    pvsToSave: {
      get() {
        return this.$store.state.analysis.pvsToSave;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["pvsToSave", value]);
      },
    },
    autoSaveAfterSearch: {
      get() {
        return this.$store.state.analysis.autoSaveAfterSearch;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["autoSaveAfterSearch", value]);
      },
    },
    overwriteInferior: {
      get() {
        return this.$store.state.analysis.overwriteInferior;
      },
      set(value) {
        this.$store.dispatch("analysis/SET", ["overwriteInferior", value]);
      },
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
    isActive() {
      return (
        this.$store.state.analysis.preferSavedResults &&
        this.hasCurrentPositionSavedResults
      );
    },
    modeResultsCount() {
      // Find the mode (most repeated number) of saved results across positions with results
      const allPlies = this.game.ptn && this.game.ptn.allPlies;
      if (!allPlies) return 1;
      const counts = {};
      const seenTps = new Set();
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
    addBot() {
      this.$store.dispatch("analysis/ADD_ACTIVE_BOT", null);
    },
    selectSavedResults() {
      this.$store.dispatch("analysis/SET", ["preferSavedResults", true]);
    },
    onBotSelect({ index, botId }) {
      this.$store.dispatch("analysis/SET_ACTIVE_BOT", { index, botId });
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
    clearSavedResults() {
      const bot = bots[this.activeBots[0]];
      if (bot) {
        bot.clearSavedResults();
        this.notifyUndo({
          icon: "delete_all",
          message: this.$t("success.resultsDeleted"),
          handler: () => {
            this.$store.dispatch("game/UNDO");
          },
        });
      }
    },
    clearCurrentPositionSavedResults() {
      if (!this.hasCurrentPositionSavedResults) {
        return;
      }
      this.$store.dispatch("game/REMOVE_POSITION_ANALYSIS_NOTES", this.tps);
      this.notifyUndo({
        icon: "delete",
        message: this.$t("success.resultsDeleted"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
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
    removeEvalMarks() {
      this.$store.dispatch("game/REMOVE_EVAL_MARKS");
      this.notifyUndo({
        icon: "eval",
        message: this.$t("success.evalMarksRemoved"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
  },
  watch: {
    sections: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["analysisSections", value]);
      },
      deep: true,
    },
    localEvalMarkThresholds: {
      handler(value) {
        const storeValue = this.$store.state.analysis.evalMarkThresholds;
        if (!isEqual(value, storeValue)) {
          this.$store.dispatch("analysis/SET", [
            "evalMarkThresholds",
            cloneDeep(value),
          ]);
        }
      },
      deep: true,
    },
    "$store.state.analysis.evalMarkThresholds": {
      handler(value) {
        if (!isEqual(value, this.localEvalMarkThresholds)) {
          this.localEvalMarkThresholds = cloneDeep(value);
        }
      },
      deep: true,
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

<style lang="scss">
.interactive-control {
  background-color: $dim;
  body.body--light & {
    background-color: $highlight;
  }
}
</style>
