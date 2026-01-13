<template>
  <div class="toolbar-analysis-container">
    <div class="button-container absolute q-gutter-x-md">
      <template
        v-if="
          !collapsed &&
          !isEmbedded &&
          !showBigButtons &&
          bot &&
          botState &&
          botMeta
        "
      >
        <template
          v-if="
            botState.isReady &&
            !botState.isRunning &&
            (!botMeta.requiresConnect || botState.isConnected)
          "
        >
          <template v-if="$q.screen.gt.sm">
            <!-- Analyze Position -->
            <q-btn
              @click="bot.analyzeCurrentPosition()"
              icon="board"
              class="dimmed-btn"
              v-ripple="false"
              :color="btnColor"
              dense
              flat
            >
              <hint>{{ $t("analysis.Analyze Position") }}</hint>
            </q-btn>

            <!-- Analyze Branch -->
            <q-btn
              @click="bot.analyzeBranch()"
              icon="branch"
              class="dimmed-btn"
              v-ripple="false"
              :color="btnColor"
              dense
              flat
            >
              <hint>{{ $t("analysis.Analyze Branch") }}</hint>
            </q-btn>

            <!-- Analyze Game -->
            <q-btn
              @click="bot.analyzeGame()"
              icon="branches_all"
              class="dimmed-btn"
              v-ripple="false"
              :color="btnColor"
              dense
              flat
            >
              <hint>{{ $t("analysis.Analyze Game") }}</hint>
            </q-btn>
          </template>

          <!-- Interactive Analysis -->
          <q-btn
            v-if="botMeta.isInteractive && bot.isInteractiveAvailable"
            @click="toggleInteractiveAnalysis"
            icon="int_analysis"
            class="dimmed-btn"
            v-ripple="false"
            :color="btnColor"
            dense
            flat
          >
            <hint>{{ "toggleInteractiveAnalysis" }}</hint>
          </q-btn>
        </template>

        <!-- Bot Progress -->
        <BotProgress
          v-if="botState.isRunning"
          @click="cancelAnalysis"
          is-running
          :interactive="bot.isInteractiveEnabled"
          :progress="botState.progress"
          color="primary"
          dense
          flat
        />

        <!-- Connect -->
        <q-btn
          v-else-if="botMeta.requiresConnect && !botState.isConnected"
          @click="bot.connect()"
          :loading="botState.isConnecting"
          :class="['connect-toggle', 'dimmed-btn']"
          v-ripple="false"
          :color="btnColor"
          dense
          flat
        >
          <q-icon name="connect" />
          <hint>{{ $t("tei.connect") }}</hint>
        </q-btn>
      </template>

      <!-- Bot Selector -->
      <q-btn
        v-if="!isEmbedded && (activeBots.length > 1 || hasSavedSuggestions)"
        class="bot-selector-toggle dimmed-btn"
        v-ripple="false"
        :color="btnColor"
        dense
        flat
        @wheel="scrollBotSelector"
      >
        <q-icon
          :name="viewingSavedResults ? 'save' : botOption.icon || 'bot'"
        />
        <hint>
          {{ viewingSavedResults ? $t("Saved Results") : botOption.label }}
        </hint>
        <q-menu anchor="top right" self="bottom right">
          <q-list>
            <q-item
              v-for="(id, idx) in activeBots"
              :key="idx"
              clickable
              v-close-popup
              @click="selectBot(id)"
              :active="id === botID && !viewingSavedResults"
            >
              <q-item-section avatar>
                <q-icon :name="getBotIcon(id)" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ getBotLabel(id) }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-separator v-if="hasSavedSuggestions" />
            <q-item
              v-if="hasSavedSuggestions"
              clickable
              v-close-popup
              @click="selectSavedResults"
              :active="viewingSavedResults"
            >
              <q-item-section avatar>
                <q-icon name="save" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Saved Results") }}</q-item-label>
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
        :class="{ embedded: isEmbedded }"
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
          <AnalysisItemPlaceholder v-else />
        </template>
        <template v-else>
          <q-item-label caption>
            <span class="bot-name absolute">{{ bot.label }}</span>
          </q-item-label>
          <q-btn
            v-if="botMeta && botMeta.requiresConnect && !botState.isConnected"
            @click="bot.connect()"
            :loading="botState.isConnecting"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width toolbar-analysis"
            color="hldim"
            stretch
            flat
          />
          <q-btn
            v-else-if="bot && bot.hasOptions && !botState.isReady"
            @click="bot.applyOptions()"
            icon="apply"
            :label="$t('analysis.init')"
            :loading="botState.isReadying"
            class="full-width toolbar-analysis"
            color="hldim"
            stretch
            flat
          />
          <div class="position-relative" v-else-if="!isEmbedded">
            <q-btn-group spread stretch>
              <q-btn
                @click="bot.analyzeCurrentPosition()"
                :loading="botState.isAnalyzingPosition"
                :disable="!bot.isAnalyzePositionAvailable"
                class="full-width toolbar-analysis"
                color="hldim"
                flat
              >
                <q-icon name="board" left />
                <template v-if="$q.screen.gt.sm">
                  {{ $t("analysis.Analyze Position") }}
                </template>
                <hint v-else>{{ $t("analysis.Analyze Position") }}</hint>
              </q-btn>
              <q-btn
                @click="bot.analyzeBranch()"
                :loading="botState.isAnalyzingBranch"
                :disable="!bot.isAnalyzeGameAvailable"
                class="full-width"
                color="hldim"
                flat
              >
                <q-icon name="branch" left />
                <template v-if="$q.screen.gt.sm">
                  {{ $t("analysis.Analyze Branch") }}
                </template>
                <hint v-else>{{ $t("analysis.Analyze Branch") }}</hint>
              </q-btn>
              <q-btn
                @click="bot.analyzeGame()"
                :loading="botState.isAnalyzingGame"
                :disable="!bot.isAnalyzeGameAvailable"
                class="full-width"
                color="hldim"
                flat
              >
                <q-icon name="branches_all" left />
                <template v-if="$q.screen.gt.sm">
                  {{ $t("analysis.Analyze Game") }}
                </template>
                <hint v-else>{{ $t("analysis.Analyze Game") }}</hint>
              </q-btn>
              <q-btn
                v-if="botMeta && botMeta.isInteractive"
                @click="toggleInteractiveAnalysis"
                color="hldim"
                flat
                :disable="!bot.isInteractiveAvailable"
                class="full-width"
              >
                <q-icon name="int_analysis" left />
                <template v-if="$q.screen.gt.sm">
                  {{ $t("analysis.interactiveAnalysis") }}
                </template>
                <hint v-else>{{ $t("analysis.interactiveAnalysis") }}</hint>
              </q-btn>
            </q-btn-group>
            <q-inner-loading
              :showing="
                (botState.isConnected || !botMeta.requiresConnect) &&
                !botState.isTeiOk &&
                !botState.isReady
              "
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
import { isArray, isNumber } from "lodash";

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
    btnColor() {
      return this.$store.state.ui.theme.secondaryDark
        ? "textLight"
        : "textDark";
    },
    game() {
      return this.$store.state.game;
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
      return this.$store.state.analysis.botMetas[this.botID] || {};
    },
    botState() {
      if (this.isEmbedded || !this.botID) return null;
      return this.$store.state.analysis.botStates[this.botID] || {};
    },
    botID() {
      return this.isEmbedded ? null : this.$store.state.analysis.botID;
    },
    activeBots() {
      return (this.$store.state.analysis.activeBots || []).filter(
        (id) => id != null
      );
    },
    botList() {
      return this.$store.state.analysis.botList || [];
    },
    botOption() {
      return this.botList.find((b) => b.value === this.botID) || {};
    },
    preferSavedResults() {
      return this.$store.state.analysis.preferSavedResults;
    },
    savedSuggestions() {
      return this.$store.getters["game/suggestions"](this.tps);
    },
    hasSavedSuggestions() {
      return this.savedSuggestions.length > 0;
    },
    currentBotSuggestions() {
      if (!this.$store.state.analysis || !this.botID) return [];
      const positions = this.$store.state.analysis.botPositions[this.botID];
      return positions ? positions[this.tps] || [] : [];
    },
    hasCurrentBotSuggestions() {
      return this.currentBotSuggestions.length > 0;
    },
    suggestions() {
      // Show saved results if preferred and available
      if (this.preferSavedResults && this.hasSavedSuggestions) {
        return this.savedSuggestions;
      }
      return this.currentBotSuggestions;
    },
    viewingSavedResults() {
      // Actually viewing saved results (preferred AND available)
      return this.preferSavedResults && this.hasSavedSuggestions;
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

      // Only fall through to saved results if actually viewing saved results
      if (this.viewingSavedResults) {
        return this.$store.getters["game/suggestion"](this.tps);
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
    showBigButtons() {
      return (
        !this.isEmbedded &&
        !this.isGameEnd &&
        !this.botSuggestion &&
        (!this.botState ||
          (!this.botState.isInteractiveEnabled &&
            !this.botState.isAnalyzingGame &&
            !this.botState.isAnalyzingBranch &&
            !(this.botState.isRunning && this.botState.tps === this.tps)))
      );
    },
  },
  methods: {
    toggle() {
      this.collapsed = !this.collapsed;
    },
    selectBot(botId) {
      this.$store.dispatch("analysis/SET", ["preferSavedResults", false]);
      this.manualBotSelection = true;
      if (botId && botId !== this.botID) {
        this.$store.dispatch("analysis/SET", ["botID", botId]);
      }
    },
    selectSavedResults() {
      this.$store.dispatch("analysis/SET", ["preferSavedResults", true]);
      this.manualBotSelection = false;
    },
    getBotIcon(botId) {
      const bot = bots[botId];
      return bot ? bot.icon : "bot";
    },
    getBotLabel(botId) {
      const bot = bots[botId];
      return bot ? bot.label : botId;
    },
    toggleInteractiveAnalysis() {
      if (this.bot && this.bot.isInteractiveAvailable) {
        this.bot.isInteractiveEnabled = !this.bot.isInteractiveEnabled;
      }
    },
    cancelAnalysis() {
      if (this.bot.isInteractiveEnabled) {
        this.bot.isInteractiveEnabled = false;
      } else {
        this.bot.terminate();
      }
    },
    prevSuggestion() {
      if (this.suggestionIndex > 0) {
        this.suggestionIndex--;
      } else {
        this.suggestionIndex = this.suggestionsCount - 1;
      }
    },
    nextSuggestion() {
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

      // Build list of selectable options: bots + saved results (if available)
      const options = [...this.activeBots];
      if (this.hasSavedSuggestions) {
        options.push("saved");
      }
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
        let currentIndex = this.viewingSavedResults
          ? options.indexOf("saved")
          : options.indexOf(this.botID);
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
        if (selected === "saved") {
          this.selectSavedResults();
        } else {
          this.selectBot(selected);
        }
      }

      clearTimeout(this.botSelectorScrollTimer);
      this.botSelectorScrollTimer = setTimeout(() => {
        this.botSelectorDeltaY = 0;
      }, 300);
    },
    deleteSavedSuggestion() {
      const suggestion = this.botSuggestion;
      if (!suggestion || !suggestion.source) {
        return;
      }
      this.$store.dispatch("game/REMOVE_ANALYSIS_NOTE", suggestion.source);
    },
  },
  watch: {
    tps() {
      this.suggestionIndex = 0;
    },
    activeBots: {
      handler(newBots) {
        // If the currently selected bot was removed, switch to saved results or first available bot
        if (!this.preferSavedResults && !newBots.includes(this.botID)) {
          if (this.hasSavedSuggestions) {
            this.$store.dispatch("analysis/SET", ["preferSavedResults", true]);
            this.manualBotSelection = false;
          } else if (newBots.length > 0) {
            this.$store.dispatch("analysis/SET", ["botID", newBots[0]]);
          }
        }
      },
    },
    "game.name": {
      handler() {
        // Switch to saved results when game changes
        if (this.hasSavedSuggestions) {
          this.$store.dispatch("analysis/SET", ["preferSavedResults", true]);
          this.manualBotSelection = false;
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
        if (suggestion && "evaluation" in suggestion) {
          this.$store.dispatch("game/SET_EVAL", suggestion.evaluation);
        } else {
          this.$store.dispatch("game/SET_EVAL", null);
        }
      },
      immediate: true,
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
    top: -32px;
    right: 86px;
    z-index: 1;
    &.embedded {
      right: 18px;
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
