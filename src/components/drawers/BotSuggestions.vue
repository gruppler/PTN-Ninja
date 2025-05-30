<template>
  <div>
    <q-expansion-item
      v-model="sections.botSuggestions"
      header-class="bg-accent"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon name="bot" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("analysis.Bot Moves") }}</q-item-label>
          <q-item-label v-if="botSettings.bot" caption>{{
            $t(`analysis.bots.${botSettings.bot}`)
          }}</q-item-label>
        </q-item-section>
        <q-item-section
          v-if="
            !sections.botSuggestions &&
            (loadingTiltakMoves ||
              tiltakInteractive.isLoading ||
              teiBot.isLoading ||
              loadingTiltakAnalysis ||
              loadingTopazMoves)
          "
          side
        >
          <q-spinner size="sm" />
        </q-item-section>
        <q-item-section side>
          <q-btn
            @click.stop="toggleBotSettings"
            icon="settings"
            :color="showBotSettings ? 'primary' : ''"
            dense
            round
            flat
          />
        </q-item-section>
      </template>

      <!-- Settings -->
      <smooth-reflow class="bg-ui">
        <template v-if="showBotSettings">
          <!-- Bot -->
          <q-select
            v-model="botSettings.bot"
            :options="botOptions"
            :label="$t('Bot')"
            behavior="menu"
            transition-show="none"
            transition-hide="none"
            emit-value
            map-options
            item-aligned
            filled
          >
            <template v-slot:selected-item="scope">
              <q-item-section class="fg-inherit" side>
                <q-icon :name="scope.opt.icon" class="fg-inherit" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
              </q-item-section>
            </template>
            <template v-slot:option="scope">
              <q-item
                :option="scope.opt"
                :key="scope.opt.value"
                v-bind="scope.itemProps"
                v-on="scope.itemEvents"
              >
                <q-item-section class="fg-inherit" side>
                  <q-icon :name="scope.opt.icon" class="fg-inherit" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label class="fg-inherit" caption>{{
                    scope.opt.description
                  }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- Tiltak Cloud -->
          <template v-if="botSettings.bot === 'tiltak-cloud'">
            <!-- Max Suggestions -->
            <q-input
              v-model.number="botSettings[botSettings.bot].maxSuggestedMoves"
              :label="$t('analysis.maxSuggestedMoves')"
              type="number"
              min="1"
              max="20"
              step="1"
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="moves" />
              </template>
            </q-input>
          </template>

          <!-- Topaz -->
          <template v-if="botSettings.bot === 'topaz'">
            <!-- Depth -->
            <q-input
              v-model.number="botSettings[botSettings.bot].depth"
              :label="$t('analysis.Depth')"
              type="number"
              min="2"
              max="99"
              step="1"
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="depth" />
              </template>
            </q-input>

            <!-- Time Budget -->
            <q-input
              v-model.number="botSettings[botSettings.bot].timeBudget"
              :label="$t('analysis.timeBudget')"
              type="number"
              min="1"
              max="999"
              step="1"
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="clock" />
              </template>
            </q-input>
          </template>

          <!-- TEI -->
          <template v-if="botSettings.bot === 'tei'">
            <q-item class="row q-gutter-x-sm">
              <div class="col">
                <!-- Address -->
                <q-input
                  v-model.number="botSettings.tei.address"
                  :label="$t('tei.address')"
                  :prefix="wsProtocol"
                  filled
                  :disable="teiBot.isConnected || teiBot.isConnecting"
                />
              </div>

              <div class="col">
                <!-- Port -->
                <q-input
                  v-model.number="botSettings.tei.port"
                  :label="$t('tei.port')"
                  type="number"
                  min="0"
                  max="65535"
                  step="1"
                  prefix=":"
                  filled
                  clearable
                  :disable="teiBot.isConnected || teiBot.isConnecting"
                />
              </div>
            </q-item>

            <!-- Use SSL -->
            <q-item
              tag="label"
              :disable="teiBot.isConnected || teiBot.isConnecting"
              clickable
              v-ripple
            >
              <q-item-section side>
                <q-checkbox
                  v-model="botSettings.tei.ssl"
                  :disable="teiBot.isConnected || teiBot.isConnecting"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("tei.ssl") }}</q-item-label>
              </q-item-section>
            </q-item>

            <!-- Log messages -->
            <q-item tag="label" clickable v-ripple>
              <q-item-section side>
                <q-checkbox v-model="botSettings.tei.log" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("tei.log") }}</q-item-label>
              </q-item-section>
            </q-item>

            <!-- Disconnect -->
            <q-btn
              v-if="teiBot.isConnected"
              @click="disconnectTei"
              icon="disconnect"
              :label="$t('tei.disconnect')"
              class="full-width"
              color="primary"
              stretch
            />
          </template>
        </template>
      </smooth-reflow>

      <!-- Controls -->
      <smooth-reflow>
        <!-- Tiltak Cloud -->
        <template v-if="botSettings.bot === 'tiltak-cloud'">
          <q-btn
            v-if="!isFullyAnalyzed && plies.length"
            @click="analyzeGameTiltak()"
            :loading="loadingTiltakAnalysis"
            :percentage="progressTiltakAnalysis"
            class="full-width"
            color="primary"
            stretch
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
          <q-btn
            v-if="!suggestions.length && !isGameEnd"
            @click="analyzePositionTilTak(botThinkBudgetInSeconds.short)"
            :loading="loadingTiltakMoves"
            class="full-width"
            color="primary"
            icon="board"
            :label="$t('analysis.Analyze Position')"
            stretch
          />
        </template>

        <!-- Tiltak Interactive -->
        <template v-else-if="botSettings.bot === 'tiltak'">
          <q-item class="interactive-control" tag="label" clickable v-ripple>
            <q-item-section avatar>
              <q-spinner v-if="tiltakInteractive.isLoading" size="sm" />
              <q-icon v-else name="int_analysis" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{
                $t("analysis.interactiveAnalysis")
              }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="tiltakInteractive.isEnabled" side>
              <div class="text-caption">
                {{ $n((tiltakInteractive.time || 0) / 1e3, "n0") }}
                {{ $t("analysis.secondsUnit") }}
              </div>
              <div class="text-caption">
                {{ $n(tiltakInteractive.nps || 0, "n0") }}
                {{ $t("analysis.nps") }}
              </div>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="tiltakInteractive.isEnabled" />
            </q-item-section>
          </q-item>
        </template>

        <!-- Topaz -->
        <div v-else-if="botSettings.bot === 'topaz'" class="relative-position">
          <q-btn
            v-if="!suggestions.length && !isGameEnd"
            @click="loadingTopazMoves ? null : requestTopazSuggestions()"
            :percentage="progressTopazAnalysis"
            class="full-width"
            color="primary"
            icon="board"
            :label="$t('analysis.Analyze Position')"
            :loading="loadingTopazMoves"
            :ripple="!loadingTopazMoves"
            stretch
          />
          <PlyChip
            v-if="loadingTopazMoves && analyzingPly"
            :ply="allPlies[analyzingPly.id]"
            @click.stop="goToAnalysisPly"
            no-branches
            :done="analyzingPly.isDone"
            class="absolute-left"
          />
          <q-btn
            v-if="loadingTopazMoves"
            :label="$t('Cancel')"
            @click.stop="terminateTopaz"
            class="absolute-right"
            :text-color="
              $store.state.ui.theme.primaryDark ? 'textLight' : 'textDark'
            "
            stretch
            flat
          />
        </div>

        <!-- TEI -->
        <template v-else-if="botSettings.bot === 'tei'">
          <q-item
            v-if="teiBot.isConnected"
            class="interactive-control"
            tag="label"
            clickable
            v-ripple
          >
            <q-item-section avatar>
              <q-spinner v-if="teiBot.isLoading" size="sm" />
              <q-icon v-else name="int_analysis" />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ $t("tei.run") }}
                <template v-if="teiBot.name">{{ teiBot.name }}</template>
              </q-item-label>
              <q-item-label v-if="teiBot.author" caption>
                {{ $t("tei.by") }} {{ teiBot.author }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-if="teiBot.isEnabled" side>
              <div class="text-caption">
                {{ $n((teiBot.time || 0) / 1e3, "n0") }}
                {{ $t("analysis.secondsUnit") }}
              </div>
              <div class="text-caption">
                {{ $n(teiBot.nps || 0, "n0") }}
                {{ $t("analysis.nps") }}
              </div>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="teiBot.isEnabled" />
            </q-item-section>
          </q-item>
          <q-btn
            v-else
            @click="initTei"
            :loading="teiBot.isConnecting"
            :disabled="!botSettings.tei.address"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width"
            color="primary"
            stretch
          />
        </template>
      </smooth-reflow>

      <!-- Results -->
      <smooth-reflow>
        <AnalysisItem
          v-for="(move, i) in suggestions.slice(
            0,
            botSettings[botSettings.bot].maxSuggestedMoves
          )"
          :key="i"
          :ply="move.ply"
          :evaluation="'evaluation' in move ? move.evaluation : null"
          :following-plies="move.followingPlies"
          :count="
            'visits' in move ? move.visits : 'nodes' in move ? move.nodes : null
          "
          :count-label="
            'visits' in move
              ? 'analysis.visits'
              : 'nodes' in move
              ? 'analysis.nodes'
              : null
          "
          :player1-number="
            'evaluation' in move && move.evaluation >= 0
              ? formatEvaluation(move.evaluation)
              : null
          "
          :player2-number="
            'evaluation' in move && move.evaluation < 0
              ? formatEvaluation(move.evaluation)
              : null
          "
          :depth="move.depth || null"
          :animate="['tiltak', 'tei'].includes(botSettings.bot)"
        />

        <q-item v-if="isGameEnd" class="flex-center">
          {{ $t("analysis.gameOver") }}
        </q-item>
      </smooth-reflow>

      <!-- Secondary Controls -->
      <smooth-reflow>
        <!-- Think Harder -->
        <q-btn
          v-if="
            botSettings.bot === 'tiltak-cloud' &&
            suggestions.length &&
            suggestions.every(
              ({ secondsToThink }) =>
                secondsToThink < botThinkBudgetInSeconds.long
            )
          "
          @click="analyzePositionTilTak(botThinkBudgetInSeconds.long)"
          :loading="loadingTiltakMoves"
          class="full-width"
          color="primary"
          stretch
        >
          {{ $t("analysis.Think Harder") }}
        </q-btn>

        <!-- Save Comments -->
        <div class="row no-wrap">
          <q-btn
            @click="saveEvalComments(botSettings[botSettings.bot].pvLimit)"
            class="full-width"
            color="primary"
            icon="notes"
            :label="$t('Save to Notes')"
            stretch
          />
          <q-input
            type="number"
            v-model.number="botSettings[botSettings.bot].pvLimit"
            :label="$t('analysis.pvLimit')"
            :min="0"
            :max="20"
            item-align
            filled
            dense
          />
        </div>
      </smooth-reflow>
    </q-expansion-item>
  </div>
</template>

<script>
import { cloneDeep } from "lodash";
import AnalysisItem from "../database/AnalysisItem";
import PlyChip from "../PTN/Ply.vue";

export default {
  name: "BotSuggestions",
  components: { AnalysisItem, PlyChip },
  data() {
    return {
      showBotSettings: false,
      positions: {},
      suggestions: [],
      bots: ["tiltak-cloud"],
      botSettings: cloneDeep(this.$store.state.ui.botSettings),
      botSettingsKey: this.getBotSettingsKey(this.$store.state.ui.botSettings),
      sections: cloneDeep(this.$store.state.ui.analysisSections),
    };
  },
  computed: {
    botOptions() {
      return this.bots.concat(["tei"]).map((value) => ({
        value,
        label: this.$t(`analysis.bots.${value}`),
        description: this.$t(`analysis.bots_description.${value}`),
        icon:
          value === "tei"
            ? "tei"
            : value.endsWith("-cloud")
            ? "online"
            : "local",
      }));
    },
    isOffline() {
      return this.$store.state.ui.offline;
    },
    isPanelVisible() {
      return (
        this.$store.state.ui.showText &&
        this.$store.state.ui.textTab === "analysis"
      );
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    allPlies() {
      return this.$store.state.game.ptn.allPlies;
    },
    plies() {
      return this.$store.state.game.ptn[
        [this.showAllBranches ? "allPlies" : "branchPlies"]
      ];
    },
    isFullyAnalyzed() {
      return this.plies.every((ply) => this.plyHasEvalComment(ply));
    },
    botPosition() {
      return this.positions[this.tps] || null;
    },
  },
  methods: {
    toggleBotSettings() {
      this.showBotSettings = !this.showBotSettings;
      // Expand panel with settings if the panel was collapsed
      if (this.showBotSettings) {
        this.sections.botSuggestions = true;
      }
    },

    getBotSettingsKey(settings) {
      // List only the properties that affect analysis
      switch (settings.bot) {
        case "topaz":
          return Object.values([
            settings.bot,
            settings.topaz.depth,
            settings.topaz.timeBudget,
          ]).join(",");
        default:
          return settings.bot;
      }
    },

    formatEvaluation(v) {
      return `+${this.$n(Math.abs(v), "n0")}%`;
    },

    plyHasEvalComment(ply) {
      return (
        ply.id in this.game.comments.notes &&
        this.game.comments.notes[ply.id].some(
          (comment) => comment.evaluation !== null
        )
      );
    },

    getEvalComments(ply, settingsKey, pvLimit = 0) {
      let comments = [];
      let positionBefore = this.positions[ply.tpsBefore];
      let positionAfter = this.positions[ply.tpsAfter];
      let evaluationBefore = null;
      let evaluationAfter = null;

      // Assume evaluationAfter from game result
      if (ply.result && ply.result.type !== "1") {
        evaluationAfter = ply.result.isTie
          ? 0
          : 100 * (ply.result.winner === 1 ? 1 : -1);
      }

      // Get evaluationBefore from existing eval comment of previous ply
      let prevPly = this.plies.find(
        (prevPly) => prevPly.tpsAfter === ply.tpsBefore
      );
      if (prevPly && prevPly.id in this.game.comments.notes) {
        for (let i = 0; i < this.game.comments.notes[prevPly.id].length; i++) {
          evaluationBefore = this.game.comments.notes[prevPly.id][i].evaluation;
          if (evaluationBefore !== null);
          break;
        }
      }

      // Evaluation
      if (
        evaluationAfter !== null ||
        (positionAfter && settingsKey in positionAfter)
      ) {
        let evaluationComment = "";

        evaluationAfter =
          Math.round(
            100 *
              (evaluationAfter !== null
                ? evaluationAfter
                : positionAfter[settingsKey][0].evaluation)
          ) / 1e4;
        if (!isNaN(evaluationAfter)) {
          evaluationComment += `${
            evaluationAfter >= 0 ? "+" : ""
          }${evaluationAfter}`;

          // Find existing eval comment index
          if (ply.id in this.game.comments.notes) {
            const index = this.game.comments.notes[ply.id].findIndex(
              (comment) => comment.evaluation !== null
            );
            if (index >= 0) {
              evaluationComment = `!r${index}:${evaluationComment}`;
            }
          }

          comments.push(evaluationComment);
        }

        // Annotation marks
        if (
          evaluationBefore !== null ||
          (positionBefore && settingsKey in positionBefore)
        ) {
          evaluationBefore =
            Math.round(
              100 *
                (evaluationBefore !== null
                  ? evaluationBefore
                  : positionBefore[settingsKey][0].evaluation)
            ) / 1e4;
          const scoreLoss =
            (ply.player === 1
              ? evaluationAfter - evaluationBefore
              : evaluationBefore - evaluationAfter) / 2;
          if (scoreLoss > 0.06) {
            comments.push("!!");
          } else if (scoreLoss > 0.03) {
            comments.push("!");
          } else if (scoreLoss > -0.1) {
            // Do nothing
          } else if (scoreLoss > -0.25) {
            comments.push("?");
          } else {
            comments.push("??");
          }
        }
      }

      // PV
      if (positionBefore && settingsKey in positionBefore) {
        let position = positionBefore[settingsKey][0];
        if (position && position.ply) {
          let pv = [position.ply, ...position.followingPlies];
          if (pvLimit) {
            pv = pv.slice(0, pvLimit);
          }
          pv = pv.map((ply) => ply.ptn);
          let pvComment = `pv ${pv.join(" ")}`;

          // Find existing pv comment index
          if (ply.id in this.game.comments.notes) {
            const index = this.game.comments.notes[ply.id].findIndex(
              (comment) =>
                comment.pv !== null &&
                comment.pv.every(
                  (cpv) =>
                    cpv.every((ply, i) => ply === pv[i]) ||
                    pv.every((ply, i) => ply === cpv[i])
                )
            );
            if (index >= 0) {
              pvComment = `!r${index}:${pvComment}`;
            }
          }

          comments.push(pvComment);
        }
      }
      return comments;
    },

    saveEvalComments(
      pvLimit = 0,
      plies = this.plies,
      settingsKey = this.botSettingsKey
    ) {
      const messages = {};
      plies.forEach((ply) => {
        const notes = [];
        const evaluations = this.getEvalComments(ply, settingsKey, pvLimit);
        if (evaluations.length) {
          notes.push(...evaluations);
        }
        if (notes.length) {
          messages[ply.id] = notes;
        }
      });
      this.$store.dispatch("game/ADD_NOTES", messages);
    },

    goToAnalysisPly() {
      if (this.analyzingPly) {
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.analyzingPly.id,
          isDone: this.analyzingPly.isDone,
        });
      }
    },

    init() {
      // Load wasm bots
      this.initTiltakInteractive();
      this.initTopaz();

      // Try to connect to TEI bot
      this.initTei();
    },
  },

  mounted() {
    return this.init();
  },

  watch: {
    async isOffline(isOffline) {
      if (!isOffline && this.isPanelVisible) {
        if (!this.topazWorker || !this.tiltakWorker) {
          this.init();
        }
      }
    },
    async isPanelVisible(isPanelVisible) {
      if (isPanelVisible) {
        this.init();
      }
    },
    "tiltakInteractive.isEnabled"(isEnabled) {
      if (isEnabled) {
        this.requestTiltakInteractiveSuggestions();
      } else {
        this.terminateTiltakInteractive();
      }
    },
    "teiBot.isEnabled"(isEnabled) {
      if (isEnabled) {
        this.requestTeiSuggestions();
      } else {
        this.terminateTei();
      }
    },
    tps() {
      if (this.tiltakInteractive.isEnabled) {
        this.requestTiltakInteractiveSuggestions();
      }
      if (this.teiBot.isEnabled) {
        this.requestTeiSuggestions();
      }
    },
    botPosition(position) {
      if (position) {
        if (this.botSettingsKey in position) {
          this.suggestions = position[this.botSettingsKey] || [];
        } else {
          this.suggestions = [];
        }
      } else {
        this.suggestions = [];
      }
    },
    suggestions(suggestions) {
      const suggestion = suggestions[0];
      if (suggestion && "evaluation" in suggestion) {
        this.$store.dispatch("game/SET_EVAL", suggestion.evaluation);
      } else {
        this.$store.dispatch("game/SET_EVAL", null);
      }
    },
    botSettingsKey(key) {
      if (this.botPosition && key in this.botPosition) {
        this.suggestions = this.botPosition[key] || [];
      } else {
        this.suggestions = [];
      }
    },
    sections: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["analysisSections", value]);
      },
      deep: true,
    },
    botSettings: {
      handler(settings) {
        // Save preferences
        this.$store.dispatch("ui/SET_UI", ["botSettings", settings]);

        // Update current position/bot key
        this.botSettingsKey = this.getBotSettingsKey(settings);

        // Stop interactive analysis when switching bots
        if (settings.bot !== "tiltak" && this.tiltakInteractive.isEnabled) {
          this.tiltakInteractive.isEnabled = false;
        }
      },
      deep: true,
    },
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
