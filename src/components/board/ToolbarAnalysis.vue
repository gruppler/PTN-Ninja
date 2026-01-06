<template>
  <div class="toolbar-analysis-container">
    <q-btn
      @click="toggle"
      :icon="icon"
      class="toolbar-analysis-toggle dimmed-btn absolute"
      :class="{ embedded: isEmbedded }"
      v-ripple="false"
      :color="btnColor"
      dense
      flat
    >
      <hint>{{ collapsed ? $t("Show Analysis") : $t("Hide Analysis") }}</hint>
    </q-btn>
    <q-btn
      v-if="
        !isEmbedded &&
        !showBigButtons &&
        bot &&
        botMeta &&
        botMeta.isInteractive &&
        bot.isInteractiveAvailable &&
        (!botMeta.requiresConnect || botState.isConnected)
      "
      @click="toggleInteractiveAnalysis"
      :class="[
        'interactive-analysis-toggle',
        'absolute',
        { 'dimmed-btn': !bot.isInteractiveEnabled },
      ]"
      v-ripple="false"
      :color="bot.isInteractiveEnabled ? 'primary' : btnColor"
      dense
      flat
    >
      <q-spinner-cube
        v-if="botState.isInteractiveEnabled && botState.isRunning"
        size="sm"
      />
      <q-icon v-else name="int_analysis" />
      <hint>{{ $t("analysis.interactiveAnalysis") }}</hint>
    </q-btn>
    <q-btn
      v-else-if="
        !isEmbedded &&
        !showBigButtons &&
        bot &&
        botMeta &&
        botMeta.requiresConnect &&
        !botState.isConnected
      "
      @click="bot.connect()"
      :loading="botState.isConnecting"
      :class="['connect-toggle', 'dimmed-btn', 'absolute']"
      v-ripple="false"
      :color="btnColor"
      dense
      flat
    >
      <q-icon name="connect" />
      <hint>{{ $t("tei.connect") }}</hint>
    </q-btn>
    <q-btn
      v-if="
        !isEmbedded &&
        !showBigButtons &&
        bot &&
        botState &&
        (botState.isAnalyzingPosition ||
          botState.isAnalyzingGame ||
          botState.isAnalyzingBranch)
      "
      @click="bot.terminate()"
      :class="['cancel-analysis-toggle', 'absolute']"
      v-ripple="false"
      color="primary"
      dense
      flat
    >
      <q-spinner size="sm" />
      <hint>{{ $t("Cancel") }} {{ $t("Analysis") }}</hint>
    </q-btn>
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
          <q-linear-progress
            v-if="
              (botState && botState.isRunning) ||
              (botSuggestion && 'progress' in botSuggestion)
            "
            class="analysis-linear-progress"
            size="2px"
            :value="progress"
            :indeterminate="progress === null"
          />
          <BotAnalysisItem
            v-if="botSuggestion"
            :suggestion="botSuggestion"
            fixed-height
            class="toolbar-analysis"
            @wheel.native="scroll"
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
          <AnalysisItemPlaceholder v-else class="toolbar-analysis" />
        </template>
        <q-btn
          v-else-if="
            botMeta && botMeta.requiresConnect && !botState.isConnected
          "
          @click="bot.connect()"
          :loading="botState.isConnecting"
          icon="connect"
          :label="$t('tei.connect')"
          class="full-width toolbar-analysis"
          color="primary"
          stretch
        />
        <q-btn
          v-else-if="bot && bot.hasOptions && !botState.isReady"
          @click="bot.applyOptions()"
          icon="apply"
          :label="$t('analysis.init')"
          :loading="botState.isReadying"
          class="full-width toolbar-analysis"
          color="primary"
          stretch
        />
        <div class="position-relative" v-else-if="!isEmbedded">
          <q-btn-group spread stretch>
            <q-btn
              @click="
                botState.isAnalyzingPosition
                  ? null
                  : bot.analyzeCurrentPosition()
              "
              :loading="botState.isAnalyzingPosition"
              :disable="!bot.isAnalyzePositionAvailable"
              class="full-width toolbar-analysis"
              color="primary"
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
              color="primary"
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
              color="primary"
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
              color="primary"
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
    </smooth-reflow>
  </div>
</template>

<script>
import BotAnalysisItem from "../analysis/BotAnalysisItem";
import AnalysisItemPlaceholder from "../analysis/AnalysisItemPlaceholder";
import { parsePV } from "../../utilities";
import { isArray } from "lodash";
import { isNumber } from "lodash";

export default {
  name: "ToolbarAnalysis",
  components: {
    BotAnalysisItem,
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
      return this.isEmbedded ? null : this.$store.state.analysis.botMeta;
    },
    botState() {
      return this.isEmbedded ? null : this.$store.state.analysis.botState;
    },
    botID() {
      return this.isEmbedded ? null : this.$store.state.analysis.botID;
    },
    suggestions() {
      const botSuggestions = this.$store.state.analysis
        ? this.$store.state.analysis.botPositions[this.tps] || []
        : [];
      const noteSuggestions = this.$store.getters["game/suggestions"](this.tps);

      // Merge bot suggestions with note suggestions, avoiding duplicates
      // Bot suggestions take priority (they have more recent/detailed data)
      const merged = [...botSuggestions];
      for (const noteSugg of noteSuggestions) {
        // Check if this PV already exists in bot suggestions
        const isDuplicate = merged.some(
          (s) => s.ply && noteSugg.ply && s.ply.ptn === noteSugg.ply.ptn
        );
        if (!isDuplicate) {
          merged.push(noteSugg);
        }
      }
      return merged;
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

      return this.$store.getters["game/suggestion"](this.tps);
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
    toggleInteractiveAnalysis() {
      if (this.bot && this.bot.isInteractiveAvailable) {
        this.bot.isInteractiveEnabled = !this.bot.isInteractiveEnabled;
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
  },
  watch: {
    tps() {
      this.suggestionIndex = 0;
    },
  },
};
</script>

<style lang="scss">
.toolbar-analysis-container {
  padding-bottom: 2px;

  .analysis-linear-progress {
    position: absolute;
    top: 0;
    z-index: 1;
  }

  .toolbar-analysis-toggle,
  .cancel-analysis-toggle,
  .interactive-analysis-toggle,
  .connect-toggle {
    top: -32px;
    right: 130px;
    z-index: 1;
  }

  .toolbar-analysis-toggle {
    right: 86px;
    &.embedded {
      right: 18px;
    }
  }

  .toolbar-analysis {
    height: 108px;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  .suggestion-nav {
    z-index: 1;
    position: relative;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
}
</style>
