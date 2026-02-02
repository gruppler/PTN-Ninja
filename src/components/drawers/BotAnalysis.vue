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
            @click.stop="toggleGlobalSettings"
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
          <div v-if="showGlobalSettings" :class="'text-' + textColor">
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

            <q-separator :dark="dark" />

            <!-- Suggestions to Save -->
            <q-input
              type="number"
              v-model.number="pvsToSave"
              :label="$t('analysis.pvsToSave')"
              :min="1"
              :max="20"
              item-aligned
              filled
              :dark="dark"
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
              :dark="dark"
            />

            <!-- Save Extra Info -->
            <q-item tag="label" clickable v-ripple>
              <q-item-section>
                <q-item-label>{{
                  $t("analysis.saveSearchStats")
                }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="saveSearchStats" :dark="dark" />
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
                <q-toggle v-model="autoSaveAfterSearch" :dark="dark" />
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
                <q-toggle v-model="overwriteInferior" :dark="dark" />
              </q-item-section>
            </q-item>

            <q-separator :dark="dark" />

            <!-- Show Evaluation Marks -->
            <q-item @click="showEvalMarks = !showEvalMarks" clickable v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("analysis.showEvalMarks") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="showEvalMarks" :dark="dark" />
              </q-item-section>
            </q-item>

            <!-- Save Evaluation Marks -->
            <q-item @click="saveEvalMarks = !saveEvalMarks" clickable v-ripple>
              <q-item-section>
                <q-item-label>{{ $t("analysis.saveEvalMarks") }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="saveEvalMarks" :dark="dark" />
              </q-item-section>
            </q-item>

            <!-- Evaluation Mark Thresholds -->
            <smooth-reflow>
              <template v-if="saveEvalMarks || showEvalMarks">
                <q-item-label :class="'text-' + textColor" header>{{
                  $t("analysis.evalMarkThresholds")
                }}</q-item-label>
                <q-input
                  type="number"
                  v-model.number="evalMarkThresholds.brilliant"
                  :label="$t('analysis.thresholds.brilliant')"
                  :step="0.01"
                  :min="0.01"
                  hide-bottom-space
                  :dark="dark"
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
                  :dark="dark"
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
                  :dark="dark"
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
                  :dark="dark"
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
          <q-separator v-if="index > 0" :dark="dark" />
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
    </q-expansion-item>
  </div>
</template>

<script>
import BotSuggestions from "./BotSuggestions.vue";
import BotProgress from "../analysis/BotProgress";
import { bots } from "../../bots";
import { cloneDeep, isEqual } from "lodash";

export default {
  name: "BotAnalysis",
  components: {
    BotSuggestions,
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
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    activeBots() {
      return this.$store.state.analysis.activeBots;
    },
    defaultBotID() {
      return this.$store.state.analysis.botID;
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
    toggleGlobalSettings() {
      this.showGlobalSettings = !this.showGlobalSettings;
      if (this.showGlobalSettings) {
        this.sections.botSuggestions = true;
      }
    },
  },
  watch: {
    "sections.botSuggestions"(value) {
      const storeValue = this.$store.state.ui.analysisSections;
      if (storeValue.botSuggestions !== value) {
        this.$store.dispatch("ui/SET_UI", [
          "analysisSections",
          { ...storeValue, botSuggestions: value },
        ]);
      }
    },
    "$store.state.ui.analysisSections.botSuggestions"(value) {
      if (this.sections.botSuggestions !== value) {
        this.sections.botSuggestions = value;
      }
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
