<template>
  <div class="toolbar-analysis-container">
    <div
      class="button-container absolute q-gutter-x-md"
      :class="{ embedded: isEmbedded }"
    >
      <template
        v-if="
          !isEmbedded &&
          analysisSource !== 'openings' &&
          resolvedBot &&
          resolvedBotState &&
          resolvedBotMeta
        "
      >
        <!-- Interactive Analysis -->
        <q-btn
          v-if="
            resolvedBotState.isReady &&
            !resolvedBotState.isRunning &&
            (!resolvedBotMeta.requiresConnect ||
              resolvedBotState.isConnected) &&
            resolvedBotMeta.isInteractive &&
            resolvedBot.isInteractiveAvailable
          "
          @click="toggleInteractiveAnalysis"
          icon="int_analysis"
          class="dimmed-btn"
          v-ripple="false"
          :color="btnColor"
          dense
          flat
        >
          <hint>{{ $t("analysis.interactiveAnalysis") }}</hint>
        </q-btn>

        <q-btn
          v-if="showInlineEngineAnalysisButtons"
          @click="analyzePosition"
          icon="board"
          class="dimmed-btn"
          v-ripple="false"
          :color="btnColor"
          :disable="!resolvedBot.isAnalyzePositionAvailable"
          dense
          flat
        >
          <hint>{{ $t("analysis.Analyze Position") }}</hint>
        </q-btn>

        <q-btn
          v-if="showInlineEngineAnalysisButtons"
          @click="analyzeBranch"
          icon="branch"
          class="dimmed-btn"
          v-ripple="false"
          :color="btnColor"
          :disable="!resolvedBot.isAnalyzeGameAvailable"
          dense
          flat
        >
          <hint>{{ $t("analysis.Analyze Branch") }}</hint>
        </q-btn>

        <q-btn
          v-if="showInlineEngineAnalysisButtons"
          @click="analyzeGame"
          icon="branches_all"
          class="dimmed-btn"
          v-ripple="false"
          :color="btnColor"
          :disable="!resolvedBot.isAnalyzeGameAvailable"
          dense
          flat
        >
          <hint>{{ $t("analysis.Analyze Game") }}</hint>
        </q-btn>

        <!-- Bot Progress -->
        <BotProgress
          v-if="showInlineEngineAnalysisButton && resolvedBotState.isRunning"
          @click="cancelAnalysis"
          is-running
          :interactive="resolvedBot.isInteractiveEnabled"
          :icon="runningAnalysisIcon"
          :progress="resolvedBotState.progress"
          color="primary"
          dense
          flat
        />

        <!-- Connect -->
        <q-btn
          v-else-if="
            showInlineEngineAnalysisButton &&
            resolvedBotMeta.requiresConnect &&
            !resolvedBotState.isConnected
          "
          @click="resolvedBot.connect()"
          :loading="resolvedBotState.isConnecting"
          :class="['connect-toggle', 'dimmed-btn']"
          v-ripple="false"
          :color="btnColor"
          dense
          flat
        >
          <q-icon name="connect" />
          <hint>{{ $t("tei.connect") }}</hint>
        </q-btn>

        <q-separator
          v-if="showInlineEngineAnalysisButton"
          vertical
          :dark="$store.state.ui.theme.secondaryDark"
        />

        <!-- Save -->
        <q-btn
          v-if="showInlineEngineResultsButtons"
          icon="save_move"
          class="dimmed-btn"
          v-ripple="false"
          :color="btnColor"
          dense
          flat
        >
          <hint>{{ $t("Save") }}</hint>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item
                clickable
                @click="saveCurrentPositionToNotes"
                :disable="!hasCurrentBotSuggestions"
              >
                <q-item-section avatar>
                  <q-icon name="save" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $t("Save Current Position") }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                @click="saveAllResultsToNotes"
                :disable="!hasResults"
              >
                <q-item-section avatar>
                  <q-icon name="save_all" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $t("Save All") }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-separator />

              <q-item
                clickable
                @click.stop="autoSaveEachPosition = !autoSaveEachPosition"
              >
                <q-item-section>
                  <q-item-label>{{
                    $t("analysis.autoSaveEachPosition")
                  }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="autoSaveEachPosition" />
                </q-item-section>
              </q-item>

              <q-item
                clickable
                @click.stop="
                  autoSaveOnSearchComplete = !autoSaveOnSearchComplete
                "
              >
                <q-item-section>
                  <q-item-label>{{
                    $t("analysis.autoSaveOnSearchComplete")
                  }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle v-model="autoSaveOnSearchComplete" />
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>

        <!-- Delete -->
        <q-btn
          v-if="showInlineEngineResultsButtons"
          icon="delete"
          class="dimmed-btn"
          v-ripple="false"
          :color="btnColor"
          dense
          flat
        >
          <hint>{{ $t("Delete") }}</hint>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item
                clickable
                @click="clearCurrentPositionResults"
                :disable="!hasCurrentBotSuggestions"
              >
                <q-item-section avatar>
                  <q-icon name="delete_outline" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{
                    $t("analysis.Clear Positions Unsaved Results")
                  }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-item
                clickable
                @click="clearUnsavedResults"
                :disable="!hasResults"
              >
                <q-item-section avatar>
                  <q-icon name="delete_all_outline" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{
                    $t("analysis.Clear Engines Unsaved Results")
                  }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-separator />

              <q-item
                clickable
                @click="clearCurrentPositionSavedResults"
                :disable="!hasCurrentSavedSuggestions"
              >
                <q-item-section avatar>
                  <q-icon name="delete" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{
                    $t("analysis.Delete Positions Saved Results")
                  }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item
                clickable
                @click="clearSavedResults"
                :disable="!hasAnySavedResultsForActiveBot"
              >
                <q-item-section avatar>
                  <q-icon name="delete_all" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{
                    $t("analysis.Delete Engines Saved Results")
                  }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </template>

      <!-- Bot Selector -->
      <q-btn
        v-if="!isEmbedded"
        :class="[
          'bot-selector-toggle',
          showAnalysisBoard ? 'source-selector-on' : 'source-selector-off',
          { 'dimmed-btn': !showAnalysisBoard },
        ]"
        v-ripple="false"
        :color="showAnalysisBoard ? 'primary' : ''"
        :text-color="sourceSelectorTextColor"
        dense
        round
        glossy
        @wheel="scrollBotSelector"
        @contextmenu.prevent.stop="toggleAnalysisVisualizations"
      >
        <q-icon
          :name="
            analysisSource === 'openings'
              ? 'opening'
              : viewingSavedResults
              ? 'save'
              : botOption.icon || 'engine'
          "
        />
        <hint>
          {{
            analysisSource === "openings"
              ? $t("Openings")
              : viewingSavedResults
              ? savedResultsLabel
              : botOption.label
          }}
        </hint>
        <q-menu
          anchor="top right"
          self="bottom right"
          transition-show="none"
          transition-hide="none"
        >
          <q-list>
            <q-item
              clickable
              v-close-popup
              @click="selectOpenings"
              :active="analysisSource === 'openings'"
            >
              <q-item-section avatar>
                <q-icon name="opening" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Openings") }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator />
            <q-item
              v-for="(id, idx) in activeBots"
              :key="idx"
              clickable
              v-close-popup
              @click="selectBot(id)"
              :active="analysisSource === 'engines' && id === botID"
            >
              <q-item-section avatar>
                <q-icon :name="getBotIcon(id)" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ getBotLabel(id) }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator v-if="savedBotNames.length" />
            <q-item
              v-for="name in savedBotNames"
              :key="'saved-' + (name || 'other')"
              clickable
              v-close-popup
              @click="selectSavedEngine(name)"
              :active="analysisSource === 'saved' && savedBotName === name"
            >
              <q-item-section avatar>
                <q-icon name="save" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ name || $t("Other") }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <!-- Show/Hide -->
      <q-btn
        @click="toggle"
        :icon="icon"
        class="toolbar-analysis-toggle dimmed-btn"
        v-ripple="false"
        :color="btnColor"
        dense
        flat
      >
        <hint>{{ collapsed ? $t("Show Analysis") : $t("Hide Analysis") }}</hint>
      </q-btn>
    </div>
    <smooth-reflow class="relative-position">
      <template v-if="!collapsed">
        <q-item v-if="isGameEnd" class="flex-center toolbar-analysis">
          {{ $t("analysis.gameOver") }}
        </q-item>
        <template
          v-else-if="
            isEmbedded ||
            botSuggestion ||
            analysisSource === 'openings' ||
            (botState &&
              (botState.isInteractiveEnabled ||
                botState.isAnalyzingGame ||
                botState.isAnalyzingBranch ||
                (botState.isRunning && botState.tps === tps)))
          "
        >
          <BotAnalysisItem
            v-if="botSuggestion"
            :suggestion="botSuggestion"
            show-bot-name
            fixed-height
            :show-menu="viewingSavedResults"
            class="toolbar-analysis"
            @wheel.native="scroll"
            @delete="deleteSavedSuggestion"
          >
            <template v-slot:before>
              <div
                v-if="suggestionsCount > 1"
                class="suggestion-nav column items-center justify-stretch full-height"
              >
                <q-btn
                  @click.stop="prevSuggestion"
                  icon="up"
                  class="col-grow"
                  stretch
                  flat
                />
                <div class="text-no-wrap text-caption">
                  {{ suggestionIndex + 1 }} / {{ suggestionsCount }}
                </div>
                <q-btn
                  @click.stop="nextSuggestion"
                  icon="down"
                  class="col-grow"
                  stretch
                  flat
                />
              </div>
            </template>
          </BotAnalysisItem>
          <div
            v-else-if="analysisSource === 'openings'"
            class="relative-position"
          >
            <AnalysisItemPlaceholder :static="!openingStats.loading" />
            <q-item
              v-if="!openingStats.loading && !openingStats.available"
              class="flex-center text-center absolute-center full-width"
              :class="'text-' + textColor"
            >
              {{ $t("analysis.database.beyondRange") }}
            </q-item>
            <q-item
              v-else-if="!openingStats.loading"
              class="flex-center text-center absolute-center full-width"
              :class="'text-' + textColor"
            >
              {{ $t("analysis.database.newPosition") }}
            </q-item>
          </div>
          <AnalysisItemPlaceholder v-else />
        </template>
        <template v-else-if="analysisSource !== 'openings'">
          <q-item-label caption>
            <span class="bot-name absolute">{{ resolvedBot.label }}</span>
          </q-item-label>
          <q-btn
            v-if="
              resolvedBotMeta &&
              resolvedBotMeta.requiresConnect &&
              !resolvedBotState.isConnected
            "
            @click="resolvedBot.connect()"
            :loading="resolvedBotState.isConnecting"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width toolbar-analysis"
            color="hldim"
            stretch
            flat
          />
          <q-btn
            v-else-if="
              resolvedBot && resolvedBot.hasOptions && !resolvedBotState.isReady
            "
            @click="resolvedBot.applyOptions()"
            icon="apply"
            :label="$t('analysis.init')"
            :loading="resolvedBotState.isReadying"
            class="full-width toolbar-analysis"
            color="hldim"
            stretch
            flat
          />
          <div class="position-relative" v-else-if="!isEmbedded">
            <q-btn-group spread stretch>
              <q-btn
                v-if="resolvedBotMeta && resolvedBotMeta.isInteractive"
                @click="toggleInteractiveAnalysis"
                :label="
                  $q.screen.gt.sm ? $t('analysis.interactiveAnalysis') : ''
                "
                icon="int_analysis"
                class="toolbar-analysis"
                color="hldim"
                flat
                stack
                :disable="!resolvedBot.isInteractiveAvailable"
              >
                <hint v-if="!$q.screen.gt.sm">{{
                  $t("analysis.interactiveAnalysis")
                }}</hint>
              </q-btn>
              <q-btn
                @click="analyzePosition"
                :loading="resolvedBotState.isAnalyzingPosition"
                :disable="!resolvedBot.isAnalyzePositionAvailable"
                :label="$q.screen.gt.sm ? $t('analysis.Analyze Position') : ''"
                icon="board"
                class="toolbar-analysis"
                color="hldim"
                flat
                stack
              >
                <hint v-if="!$q.screen.gt.sm">{{
                  $t("analysis.Analyze Position")
                }}</hint>
              </q-btn>
              <q-btn
                @click="analyzeBranch"
                :loading="resolvedBotState.isAnalyzingBranch"
                :disable="!resolvedBot.isAnalyzeGameAvailable"
                :label="$q.screen.gt.sm ? $t('analysis.Analyze Branch') : ''"
                icon="branch"
                color="hldim"
                flat
                stack
              >
                <hint v-if="!$q.screen.gt.sm">{{
                  $t("analysis.Analyze Branch")
                }}</hint>
              </q-btn>
              <q-btn
                @click="analyzeGame"
                :loading="resolvedBotState.isAnalyzingGame"
                :disable="!resolvedBot.isAnalyzeGameAvailable"
                :label="$q.screen.gt.sm ? $t('analysis.Analyze Game') : ''"
                icon="branches_all"
                color="hldim"
                flat
                stack
              >
                <hint v-if="!$q.screen.gt.sm">{{
                  $t("analysis.Analyze Game")
                }}</hint>
              </q-btn>
            </q-btn-group>
            <q-inner-loading
              :showing="
                (resolvedBotState.isConnected ||
                  !resolvedBotMeta.requiresConnect) &&
                !resolvedBotState.isTeiOk &&
                !resolvedBotState.isReady
              "
              :dark="dark"
              :color="textColor"
            />
          </div>
        </template>
      </template>
    </smooth-reflow>
  </div>
</template>

<script>
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import BotProgress from "../analysis/BotProgress";
import AnalysisItemPlaceholder from "../analysis/AnalysisItemPlaceholder";
import { parsePV } from "../../utilities";
import { bots } from "../../bots";
import { isArray, isNumber, cloneDeep } from "lodash";

export default {
  name: "ToolbarAnalysis",
  components: {
    BotAnalysisItem,
    BotProgress,
    AnalysisItemPlaceholder,
  },
  props: {
    analysis: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      suggestionIndex: 0,
      deltaY: 0,
      scrollTimer: null,
      botSelectorDeltaY: 0,
      botSelectorScrollTimer: null,
      manualBotSelection: false,
    };
  },
  computed: {
    collapsed: {
      get() {
        return !this.$store.state.ui.showToolbarAnalysis;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showToolbarAnalysis", !value]);
      },
    },
    isEmbedded() {
      return this.$store.state.ui.embed;
    },
    icon() {
      return this.collapsed ? "up" : "down";
    },
    dark() {
      return this.$store.state.ui.theme.panelDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    sourceSelectorTextColor() {
      if (this.showAnalysisBoard) {
        return this.$store.state.ui.theme.primaryDark
          ? "textLight"
          : "textDark";
      }
      return this.btnColor;
    },
    btnColor() {
      return this.$store.state.ui.theme.secondaryDark
        ? "textLight"
        : "textDark";
    },
    showAnalysisBoard() {
      return this.$store.state.ui.showAnalysisBoard;
    },
    game() {
      return this.$store.state.game;
    },
    analysisState() {
      return this.$store.state.analysis || {};
    },
    tps() {
      return this.game.position.tps;
    },
    isGameEnd() {
      return (
        this.game.position.isGameEnd && !this.game.position.isGameEndDefault
      );
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    bot() {
      return this.isEmbedded ? null : this.$store.getters["analysis/bot"];
    },
    botMeta() {
      if (this.isEmbedded || !this.botID) return null;
      return this.analysisState.botMetas?.[this.botID] || {};
    },
    botState() {
      if (this.isEmbedded || !this.botID) return null;
      return this.analysisState.botStates?.[this.botID] || {};
    },
    botID() {
      return this.isEmbedded ? null : this.analysisState.botID;
    },
    // Resolved bot ID when in "saved" mode — finds the active engine
    // matching the saved bot name so the toolbar uses the correct instance
    resolvedBotID() {
      if (this.analysisSource === "saved" && this.savedBotName) {
        for (const id of this.activeBots) {
          const bot = bots[id];
          if (bot && bot.label === this.savedBotName) {
            return id;
          }
        }
      }
      return this.botID;
    },
    resolvedBot() {
      return bots[this.resolvedBotID] || this.bot;
    },
    resolvedBotMeta() {
      if (this.isEmbedded || !this.resolvedBotID) return null;
      return this.analysisState.botMetas?.[this.resolvedBotID] || {};
    },
    resolvedBotState() {
      if (this.isEmbedded || !this.resolvedBotID) return null;
      return this.analysisState.botStates?.[this.resolvedBotID] || {};
    },
    activeBots() {
      return (this.analysisState.activeBots || []).filter((id) => id != null);
    },
    botList() {
      return this.analysisState.botList || [];
    },
    botOption() {
      return this.botList.find((b) => b.value === this.botID) || {};
    },
    analysisSource() {
      return this.analysisState.analysisSource || "openings";
    },
    preferSavedResults() {
      return this.analysisState.preferSavedResults ?? true;
    },
    savedBotName() {
      // Get the saved bot name from state (null = "Other"/unnamed)
      return this.analysisState.savedBotName;
    },
    allSavedSuggestions() {
      return this.$store.getters["game/suggestions"](this.tps);
    },
    savedSuggestions() {
      // Filter saved suggestions by the saved bot's name
      if (this.savedBotName === null) {
        // "Other" section: suggestions without a bot name
        return this.allSavedSuggestions.filter((s) => !s.botName);
      }
      return this.allSavedSuggestions.filter(
        (s) => s.botName === this.savedBotName
      );
    },
    activeSavedBotNameForDelete() {
      if (this.analysisSource === "saved") {
        return this.savedBotName;
      }
      if (this.resolvedBot && this.resolvedBot.label) {
        return this.resolvedBot.label;
      }
      return undefined;
    },
    currentSavedSuggestions() {
      if (this.activeSavedBotNameForDelete === undefined) {
        return [];
      }
      if (this.activeSavedBotNameForDelete === null) {
        return this.allSavedSuggestions.filter((s) => !s.botName);
      }
      return this.allSavedSuggestions.filter(
        (s) => s.botName === this.activeSavedBotNameForDelete
      );
    },
    hasCurrentSavedSuggestions() {
      return this.currentSavedSuggestions.length > 0;
    },
    hasAnySavedResultsForActiveBot() {
      if (this.activeSavedBotNameForDelete === undefined) {
        return false;
      }
      const botNamesWithResults =
        this.$store.getters["analysis/savedBotNamesWithResults"];
      return botNamesWithResults
        ? botNamesWithResults.has(this.activeSavedBotNameForDelete)
        : false;
    },
    hasSavedSuggestions() {
      return this.savedSuggestions.length > 0;
    },
    hasAnySavedSuggestions() {
      return this.allSavedSuggestions.length > 0;
    },
    savedBotNames() {
      return this.$store.getters["analysis/savedBotNames"];
    },
    savedResultsLabel() {
      if (this.savedBotName === null) {
        return this.$t("Other");
      }
      return this.savedBotName || this.$t("Saved Results");
    },
    currentBotSuggestions() {
      const activeBotID = this.resolvedBotID || this.botID;
      if (!activeBotID) return [];
      const positions = this.analysisState.botPositions?.[activeBotID];
      return positions ? positions[this.tps] || [] : [];
    },
    hasCurrentBotSuggestions() {
      return this.currentBotSuggestions.length > 0;
    },
    openingSuggestions() {
      return this.analysisState.currentOpeningMoves || [];
    },
    openingStats() {
      return this.analysisState.openingStats || {};
    },
    showLiveCurrentPositionInSavedMode() {
      if (this.analysisSource !== "saved") {
        return false;
      }
      const state = this.resolvedBotState;
      return !!(state && state.isRunning && state.tps === this.tps);
    },
    suggestions() {
      switch (this.analysisSource) {
        case "openings":
          return this.openingSuggestions;
        case "saved":
          if (this.showLiveCurrentPositionInSavedMode) {
            return this.currentBotSuggestions;
          }
          // Fall back to live engine results when no saved results exist
          return this.savedSuggestions.length > 0
            ? this.savedSuggestions
            : this.currentBotSuggestions;
        case "engines":
        default:
          return this.currentBotSuggestions;
      }
    },
    viewingSavedResults() {
      return this.analysisSource === "saved";
    },
    suggestionsCount() {
      return this.suggestions.length;
    },
    botSuggestion() {
      if (this.analysis) {
        if (
          this.analysis.pv &&
          (!this.analysis.ply || this.analysis.followingPlies)
        ) {
          const pv = parsePV(
            this.game.position.turn,
            this.game.position.color,
            isArray(this.analysis.pv)
              ? this.analysis.pv
              : this.analysis.pv.split(/\s+/)
          );
          return {
            ply: pv.splice(0, 1)[0],
            followingPlies: pv,
            ...this.analysis,
          };
        } else {
          return this.analysis;
        }
      }

      if (this.suggestions.length > 0) {
        return this.suggestions[this.suggestionIndex] || this.suggestions[0];
      }

      return null;
    },
    progress() {
      if (this.botSuggestion && "progress" in this.botSuggestion) {
        if (this.botSuggestion.progress === null) {
          return null;
        }
        return this.botSuggestion.progress / 100;
      } else if (isNumber(this.botState.progress)) {
        return this.botState.progress / 100;
      } else {
        return null;
      }
    },
    runningAnalysisIcon() {
      const state = this.resolvedBotState;
      if (!state || state.isInteractiveEnabled) {
        return null;
      }
      if (state.isAnalyzingPosition) {
        return "board";
      }
      if (state.isAnalyzingBranch) {
        return "branch";
      }
      if (state.isAnalyzingGame) {
        return "branches_all";
      }
      return null;
    },
    positions() {
      if (!this.botID) return {};
      return this.analysisState.botPositions?.[this.botID] || {};
    },
    hasResults() {
      return Object.keys(this.positions).length > 0;
    },
    autoSaveEachPosition: {
      get() {
        return this.analysisState.autoSaveEachPosition || false;
      },
      set(value) {
        if (this.$store.state.analysis) {
          this.$store.dispatch("analysis/SET", ["autoSaveEachPosition", value]);
        }
      },
    },
    autoSaveOnSearchComplete: {
      get() {
        return this.analysisState.autoSaveOnSearchComplete || false;
      },
      set(value) {
        if (this.$store.state.analysis) {
          this.$store.dispatch("analysis/SET", [
            "autoSaveOnSearchComplete",
            value,
          ]);
        }
      },
    },
    showBigButtons() {
      const state = this.resolvedBotState;
      return (
        !this.isEmbedded &&
        !this.isGameEnd &&
        !this.botSuggestion &&
        (!state ||
          (!state.isInteractiveEnabled &&
            !state.isAnalyzingGame &&
            !state.isAnalyzingBranch &&
            !(state.isRunning && state.tps === this.tps)))
      );
    },
    showInlineEngineAnalysisButtons() {
      const boardSpaceWidth = this.$store.state.ui.boardSpace?.width || 0;
      const state = this.resolvedBotState;
      const meta = this.resolvedBotMeta;
      return (
        boardSpaceWidth >= 540 &&
        state.isReady &&
        !state.isRunning &&
        (!meta.requiresConnect || state.isConnected)
      );
    },
    showInlineEngineAnalysisButton() {
      const boardSpaceWidth = this.$store.state.ui.boardSpace?.width || 0;
      return boardSpaceWidth >= 396;
    },
    showInlineEngineResultsButtons() {
      const boardSpaceWidth = this.$store.state.ui.boardSpace?.width || 0;
      return boardSpaceWidth >= 342;
    },
  },
  methods: {
    clearSuggestionPreview() {
      this.$store.commit("analysis/SET_HOVERED_OVERLAY_PLY_TEXT", null);
      this.$store.dispatch("game/HIGHLIGHT_SQUARES", null);
    },
    toggle() {
      this.collapsed = !this.collapsed;
    },
    toggleAnalysisVisualizations() {
      this.$store.dispatch("ui/SET_UI", [
        "showAnalysisBoard",
        !this.showAnalysisBoard,
      ]);
    },
    selectBot(botId) {
      this.$store.dispatch("analysis/SELECT_ENGINE", botId);
      this.manualBotSelection = true;
    },
    selectSavedResults() {
      this.$store.dispatch("analysis/SET", ["preferSavedResults", true]);
      this.manualBotSelection = false;
    },
    selectSavedEngine(botName) {
      this.$store.dispatch("analysis/SELECT_SAVED_ENGINE", botName);
      this.manualBotSelection = false;
    },
    selectOpenings() {
      this.$store.dispatch("analysis/SELECT_OPENINGS");
      this.manualBotSelection = false;
    },
    getBotIcon(botId) {
      const bot = bots[botId];
      return bot ? bot.icon : "engine";
    },
    getBotLabel(botId) {
      const bot = bots[botId];
      return bot ? bot.label : botId;
    },
    ensureEngineSelected() {
      // When in "saved" mode, switch to the resolved engine before starting
      // analysis so it uses the same instance as the Engines panel
      if (this.resolvedBotID !== this.botID) {
        if (this.analysisSource === "saved") {
          this.$store.dispatch("analysis/SET", ["botID", this.resolvedBotID]);
        } else {
          this.$store.dispatch("analysis/SELECT_ENGINE", this.resolvedBotID);
        }
      }
      return bots[this.resolvedBotID] || this.resolvedBot;
    },
    toggleInteractiveAnalysis() {
      const bot = this.ensureEngineSelected();
      if (bot && bot.isInteractiveAvailable) {
        bot.isInteractiveEnabled = !bot.isInteractiveEnabled;
      }
    },
    analyzePosition() {
      const bot = this.ensureEngineSelected();
      if (bot) bot.analyzeCurrentPosition();
    },
    analyzeBranch() {
      const bot = this.ensureEngineSelected();
      if (bot) bot.analyzeBranch();
    },
    analyzeGame() {
      const bot = this.ensureEngineSelected();
      if (bot) bot.analyzeGame();
    },
    cancelAnalysis() {
      if (this.resolvedBot.isInteractiveEnabled) {
        this.resolvedBot.isInteractiveEnabled = false;
      } else {
        this.resolvedBot.terminate();
      }
    },
    prevSuggestion() {
      this.clearSuggestionPreview();
      if (this.suggestionIndex > 0) {
        this.suggestionIndex--;
      } else {
        this.suggestionIndex = this.suggestionsCount - 1;
      }
    },
    nextSuggestion() {
      this.clearSuggestionPreview();
      if (this.suggestionIndex < this.suggestionsCount - 1) {
        this.suggestionIndex++;
      } else {
        this.suggestionIndex = 0;
      }
    },
    scroll(event) {
      if (!this.$store.state.ui.scrollScrubbing || this.suggestionsCount <= 1) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const scrollThreshold =
        this.$store.state.ui.scrollThreshold || window.devicePixelRatio * 100;

      this.deltaY += event.deltaY;
      if (Math.abs(this.deltaY) >= scrollThreshold) {
        const times = Math.floor(Math.abs(this.deltaY) / scrollThreshold);
        this.deltaY = this.deltaY % scrollThreshold;
        for (let i = 0; i < times; i++) {
          if (event.deltaY > 0) {
            this.nextSuggestion();
          } else {
            this.prevSuggestion();
          }
        }
      }

      clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.deltaY = 0;
      }, 300);
    },
    scrollBotSelector(event) {
      if (!this.$store.state.ui.scrollScrubbing) {
        return;
      }

      // Build list of selectable options: openings + bots + per-engine saved results
      const options = [{ type: "openings" }];
      this.activeBots.forEach((id) => {
        options.push({ type: "bot", id });
      });
      this.savedBotNames.forEach((name) => {
        options.push({ type: "saved", name });
      });
      if (options.length <= 1) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const scrollThreshold =
        this.$store.state.ui.scrollThreshold || window.devicePixelRatio * 100;

      this.botSelectorDeltaY += event.deltaY;
      if (Math.abs(this.botSelectorDeltaY) >= scrollThreshold) {
        const times = Math.floor(
          Math.abs(this.botSelectorDeltaY) / scrollThreshold
        );
        this.botSelectorDeltaY = this.botSelectorDeltaY % scrollThreshold;

        // Find current index
        let currentIndex;
        if (this.analysisSource === "openings") {
          currentIndex = 0;
        } else if (this.analysisSource === "saved") {
          currentIndex = options.findIndex(
            (o) => o.type === "saved" && o.name === this.savedBotName
          );
        } else {
          currentIndex = options.findIndex(
            (o) => o.type === "bot" && o.id === this.botID
          );
        }
        if (currentIndex < 0) currentIndex = 0;

        for (let i = 0; i < times; i++) {
          if (event.deltaY > 0) {
            currentIndex = (currentIndex + 1) % options.length;
          } else {
            currentIndex = (currentIndex - 1 + options.length) % options.length;
          }
        }

        // Select the new option
        const selected = options[currentIndex];
        if (selected.type === "openings") {
          this.selectOpenings();
        } else if (selected.type === "saved") {
          this.selectSavedEngine(selected.name);
        } else {
          this.selectBot(selected.id);
        }
      }

      clearTimeout(this.botSelectorScrollTimer);
      this.botSelectorScrollTimer = setTimeout(() => {
        this.botSelectorDeltaY = 0;
      }, 300);
    },
    saveCurrentPositionToNotes() {
      if (this.bot) {
        this.bot.saveEvalComments(this.tps);
      }
    },
    saveAllResultsToNotes() {
      if (this.bot) {
        this.bot.saveEvalComments();
      }
    },
    clearCurrentPositionResults() {
      if (!this.hasResults || !this.hasCurrentBotSuggestions) {
        return;
      }
      const tps = this.tps;
      const before = cloneDeep(this.positions[tps]);
      this.$store.commit("analysis/DELETE_BOT_POSITION", {
        botID: this.botID,
        tps,
      });
      this.notifyUndo({
        icon: "delete",
        message: this.$t("success.resultsCleared"),
        handler: () => {
          if (before) {
            this.$store.commit("analysis/SET_BOT_POSITION", {
              botID: this.botID,
              tps,
              suggestions: before,
            });
          }
        },
      });
    },
    clearUnsavedResults() {
      if (!this.hasResults) {
        return;
      }
      const before = cloneDeep(this.positions);
      this.bot.clearResults();
      this.notifyUndo({
        icon: "delete_all_outline",
        message: this.$t("success.resultsCleared"),
        handler: () => {
          this.$store.commit("analysis/SET_BOT_POSITIONS", {
            botID: this.botID,
            positions: before,
          });
        },
      });
    },
    clearCurrentPositionSavedResults() {
      if (!this.hasCurrentSavedSuggestions) {
        return;
      }
      this.$store.dispatch("game/REMOVE_POSITION_BOT_ANALYSIS_NOTES", {
        tps: this.tps,
        botName: this.activeSavedBotNameForDelete,
      });
      this.notifyUndo({
        icon: "delete",
        message: this.$t("success.resultsDeleted"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    clearSavedResults() {
      if (!this.hasAnySavedResultsForActiveBot) {
        return;
      }
      this.$store.dispatch(
        "game/REMOVE_BOT_ANALYSIS_NOTES",
        this.activeSavedBotNameForDelete
      );
      if (
        this.analysisSource === "saved" &&
        this.activeSavedBotNameForDelete === null
      ) {
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
    deleteSavedSuggestion() {
      const suggestion = this.botSuggestion;
      if (!suggestion || !suggestion.source) {
        return;
      }
      this.$store.dispatch("game/REMOVE_ANALYSIS_NOTE", suggestion.source);
    },
    setEvalOverrideFromSuggestion(suggestion) {
      if (suggestion && ("evaluation" in suggestion || "wdl" in suggestion)) {
        this.$store.dispatch("game/SET_EVAL", {
          evaluation: suggestion.evaluation ?? null,
          wdl: suggestion.wdl || null,
        });
      } else {
        this.$store.dispatch("game/SET_EVAL", null);
      }
    },
    updateEvalFromState() {
      // Update eval based on current preferSavedResults and savedBotName/botID
      const suggestion = this.botSuggestion;
      this.setEvalOverrideFromSuggestion(suggestion);
    },
  },
  watch: {
    tps() {
      this.suggestionIndex = 0;
    },
    activeBots: {
      handler(newBots) {
        // If the currently selected bot was removed, switch to saved results or first available bot
        if (
          this.analysisSource === "engines" &&
          !newBots.includes(this.botID)
        ) {
          if (this.hasSavedSuggestions) {
            this.$store.dispatch(
              "analysis/SELECT_SAVED_ENGINE",
              this.savedBotName
            );
            this.manualBotSelection = false;
          } else if (newBots.length > 0) {
            this.$store.dispatch("analysis/SET", ["botID", newBots[0]]);
          }
        }
      },
    },
    botSuggestion: {
      handler(suggestion) {
        // Update highlight when suggestion changes (e.g., from scrolling)
        // Only update if highlight is already being overridden (hlSquares is non-empty)
        if (
          suggestion &&
          suggestion.ply &&
          this.$store.state.game.hlSquares?.length
        ) {
          this.$store.dispatch(
            "game/HIGHLIGHT_SQUARES",
            suggestion.ply.squares
          );
        }
        // Update eval bars with the selected suggestion's evaluation
        // (regardless of whether toolbar is collapsed)
        this.setEvalOverrideFromSuggestion(suggestion);
      },
      immediate: true,
    },
    savedBotName() {
      // When savedBotName changes, update eval from the new bot's suggestions
      this.updateEvalFromState();
    },
    preferSavedResults() {
      // When preferSavedResults changes, update eval accordingly
      this.updateEvalFromState();
    },
    analysisSource() {
      // When analysisSource changes, update eval accordingly
      this.updateEvalFromState();
    },
  },
  beforeDestroy() {
    // Clear eval override when component is destroyed
    this.$store.dispatch("game/SET_EVAL", null);
  },
};
</script>

<style lang="scss">
.toolbar-analysis-container {
  padding-bottom: 2px;

  .button-container {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    top: -34px;
    right: 86px;
    z-index: 1;
    &.embedded {
      right: 40px;
    }
  }

  .toolbar-analysis {
    height: 108px;
  }

  .suggestion-nav {
    z-index: 1;
    position: relative;
  }

  .bot-name.absolute {
    top: 1px;
    left: 16px;
  }
}
</style>
