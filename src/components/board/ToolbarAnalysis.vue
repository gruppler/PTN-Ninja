<template>
  <div class="toolbar-analysis-container">
    <q-btn
      @click="toggle"
      :icon="icon"
      class="toolbar-analysis-toggle dimmed-btn absolute"
      v-ripple="false"
      :color="btnColor"
      dense
      flat
    />
    <smooth-reflow class="relative-position">
      <template v-if="!collapsed">
        <template
          v-if="
            botSuggestion ||
            botState.isInteractiveEnabled ||
            botState.isAnalyzingGame ||
            (botState.isRunning && botState.tps === this.tps)
          "
        >
          <q-linear-progress
            v-if="botState.isRunning"
            class="analysis-linear-progress"
            size="2px"
            :value="botState.progress / 100"
            :indeterminate="botState.progress === null"
          />
          <BotAnalysisItem
            v-if="botSuggestion"
            :suggestion="botSuggestion"
            fixed-height
            class="toolbar-analysis"
          />
          <AnalysisItemPlaceholder v-else class="toolbar-analysis" />
        </template>
        <q-item v-else-if="isGameEnd" class="flex-center toolbar-analysis">
          {{ $t("analysis.gameOver") }}
        </q-item>
        <q-btn
          v-else-if="botMeta.requiresConnect && !botState.isConnected"
          @click="bot.connect()"
          :loading="botState.isConnecting"
          icon="connect"
          :label="$t('tei.connect')"
          class="full-width toolbar-analysis"
          color="primary"
          stretch
        />
        <q-btn
          v-else-if="bot.hasOptions && !botState.isReady"
          @click="bot.applyOptions()"
          icon="apply"
          :label="$t('analysis.init')"
          :loading="botState.isReadying"
          class="full-width toolbar-analysis"
          color="primary"
          stretch
        />
        <div class="position-relative" v-else>
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
              icon="board"
              :label="$t('analysis.Analyze Position')"
            />
            <q-btn
              @click="bot.analyzeGame()"
              :loading="botState.isAnalyzingGame"
              :disable="!bot.isAnalyzeGameAvailable"
              class="full-width"
              color="primary"
            >
              <q-icon
                :name="showAllBranches ? 'moves' : 'branch'"
                :class="{ 'rotate-180': !showAllBranches }"
                left
              />
              {{
                $t(
                  showAllBranches
                    ? "analysis.Analyze Game"
                    : "analysis.Analyze Branch"
                )
              }}
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

export default {
  name: "ToolbarAnalysis",
  components: {
    BotAnalysisItem,
    AnalysisItemPlaceholder,
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
    icon() {
      return this.collapsed ? "up" : "down";
    },
    btnColor() {
      return this.$store.state.ui.theme.secondaryDark
        ? "textLight"
        : "textDark";
    },
    tps() {
      return this.$store.state.game.position.tps;
    },
    isGameEnd() {
      return (
        this.$store.state.game.position.isGameEnd &&
        !this.$store.state.game.position.isGameEndDefault
      );
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    bot() {
      return this.$store.getters["analysis/bot"];
    },
    botMeta() {
      return this.$store.state.analysis.botMeta;
    },
    botState() {
      return this.$store.state.analysis.botState;
    },
    botSuggestion() {
      const suggestions = this.$store.state.analysis.botPositions[this.tps];
      if (suggestions) {
        return suggestions[0];
      }

      // Get suggestion from notes
      const game = this.$store.state.game;
      const tps = this.tps;
      const suggestion = {
        evaluation: null,
        ply: null,
        followingPlies: [],
        time: null,
      };
      let notes;
      let note;
      let ply;
      for (let id in game.comments.notes) {
        notes = game.comments.notes[id];
        ply = game.ptn.allPlies[id];
        if (suggestion.ply === null && ply.tpsBefore === tps) {
          note = notes.find((n) => n.pv !== null);
          if (note) {
            const pv = parsePV(ply.player, ply.color, note.pv[0]);
            suggestion.ply = pv.splice(0, 1)[0];
            suggestion.followingPlies = pv;
          }
        }
        if (
          suggestion.evaluation === null &&
          (ply.tpsAfter === tps || (ply.id === 0 && ply.tpsBefore === tps))
        ) {
          note = notes.find((n) => n.evaluation !== null);
          if (note) {
            suggestion.evaluation = note.evaluation;
          }
        }
        if (suggestion.ply && suggestion.evaluation) {
          break;
        }
      }

      return suggestion.ply ? suggestion : null;
    },
  },
  methods: {
    toggle() {
      this.collapsed = !this.collapsed;
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

  .toolbar-analysis-toggle {
    top: -32px;
    right: 86px;
    z-index: 1;
  }

  .toolbar-analysis {
    height: 108px;
  }
}
</style>
