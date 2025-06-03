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
          v-if="!sections.botSuggestions && bot.status.isLoading"
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
          <template v-if="bot && botSettings.bot === 'tei'">
            <q-item class="row q-gutter-x-sm">
              <div class="col">
                <!-- Address -->
                <q-input
                  v-model.number="botSettings.tei.address"
                  :label="$t('tei.address')"
                  :prefix="bot.protocol"
                  filled
                  :disable="bot.status.isConnected || bot.status.isConnecting"
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
                  :disable="bot.status.isConnected || bot.status.isConnecting"
                />
              </div>
            </q-item>

            <!-- Use SSL -->
            <q-item
              tag="label"
              :disable="bot.status.isConnected || bot.status.isConnecting"
              clickable
              v-ripple
            >
              <q-item-section side>
                <q-checkbox
                  v-model="botSettings.tei.ssl"
                  :disable="bot.status.isConnected || bot.status.isConnecting"
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
              v-if="bot.status.isConnected"
              @click="bot.disconnect()"
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
        <!-- TEI -->
        <template v-if="bot && bot.id === 'tei'">
          <q-item
            v-if="bot.status.isConnected"
            class="interactive-control"
            tag="label"
            clickable
            v-ripple
          >
            <q-item-section avatar>
              <q-spinner v-if="bot.status.isLoading" size="sm" />
              <q-icon v-else name="int_analysis" />
            </q-item-section>
            <q-item-section>
              <q-item-label>
                {{ $t("tei.run") }}
                <template v-if="bot.meta.name">{{ bot.meta.name }}</template>
              </q-item-label>
              <q-item-label v-if="bot.meta.author" caption>
                {{ $t("tei.by") }} {{ bot.meta.author }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-if="bot.status.isEnabled" side>
              <div class="text-caption">
                {{ $n((bot.status.time || 0) / 1e3, "n0") }}
                {{ $t("analysis.secondsUnit") }}
              </div>
              <div class="text-caption">
                {{ $n(bot.status.nps || 0, "n0") }}
                {{ $t("analysis.nps") }}
              </div>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="bot.status.isEnabled" />
            </q-item-section>
          </q-item>
          <q-btn
            v-else
            @click="bot.connect()"
            :loading="bot.status.isConnecting"
            :disabled="!botSettings.tei.address"
            icon="connect"
            :label="$t('tei.connect')"
            class="full-width"
            color="primary"
            stretch
          />
        </template>

        <!-- Tiltak Cloud -->
        <template v-else-if="botSettings.bot === 'tiltak-cloud'">
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

        <!-- Generic Interactive -->
        <template v-else-if="bot && bot.isInteractive">
          <q-item class="interactive-control" tag="label" clickable v-ripple>
            <q-item-section avatar>
              <q-spinner v-if="bot.status.isLoading" size="sm" />
              <q-icon v-else name="int_analysis" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{
                $t("analysis.interactiveAnalysis")
              }}</q-item-label>
            </q-item-section>
            <q-item-section v-if="bot.status.isEnabled" side>
              <div class="text-caption">
                {{ $n((bot.status.time || 0) / 1e3, "n0") }}
                {{ $t("analysis.secondsUnit") }}
              </div>
              <div class="text-caption">
                {{ $n(bot.status.nps || 0, "n0") }}
                {{ $t("analysis.nps") }}
              </div>
            </q-item-section>
            <q-item-section side>
              <q-toggle v-model="bot.status.isEnabled" />
            </q-item-section>
          </q-item>
        </template>

        <!-- Generic Non-Interactive -->
        <div v-else-if="bot" class="relative-position">
          <q-btn
            v-if="!suggestions.length && !isGameEnd"
            @click="bot.status.isLoading ? null : bot.analyzePosition()"
            :percentage="bot.status.progress"
            class="full-width"
            color="primary"
            icon="board"
            :label="$t('analysis.Analyze Position')"
            :loading="bot.status.isLoading"
            :ripple="!bot.status.isLoading"
            stretch
          />
          <PlyChip
            v-if="bot.status.isLoading && bot.status.analyzingPly"
            :ply="allPlies[bot.status.analyzingPly.id]"
            @click.stop="goToAnalysisPly"
            no-branches
            :done="bot.status.analyzingPly.isDone"
            class="absolute-left"
          />
          <q-btn
            v-if="bot.status.isLoading"
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
import TiltakCloud from "../../bots/tiltak-cloud";
import TiltakWasm from "../../bots/tiltak-wasm";
import TopazWasm from "../../bots/topaz-wasm";
import TeiBot from "../../bots/tei";

export default {
  name: "BotSuggestions",
  components: { AnalysisItem, PlyChip },
  data() {
    return {
      showBotSettings: false,
      bots: {},
      botOptions: [],
      botSettings: cloneDeep(this.$store.state.ui.botSettings),
      sections: cloneDeep(this.$store.state.ui.analysisSections),
    };
  },
  computed: {
    bot() {
      return this.bots[this.botSettings.bot];
    },
    positions() {
      return this.bot ? this.bot.positions : {};
    },
    suggestions() {
      return this.positions[this.tps] || [];
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
    game() {
      return this.$store.state.game;
    },
    allPlies() {
      return this.game.ptn.allPlies;
    },
    plies() {
      return this.game.ptn[[this.showAllBranches ? "allPlies" : "branchPlies"]];
    },
    isGameEnd() {
      return (
        this.game.position.isGameEnd && !this.game.position.isGameEndDefault
      );
    },
    isFullyAnalyzed() {
      return this.plies.every((ply) => this.plyHasEvalComment(ply));
    },
  },
  methods: {
    addBot(bot) {
      if (this.botOptions.find((b) => b.id === bot.id)) {
        return;
      }
      this.botOptions.push({
        value: bot.id,
        label: this.$t(bot.label),
        description: this.$t(bot.description),
        icon: bot.icon,
      });
    },

    toggleBotSettings() {
      this.showBotSettings = !this.showBotSettings;
      // Expand panel with settings if the panel was collapsed
      if (this.showBotSettings) {
        this.sections.botSuggestions = true;
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

    getEvalComments(ply, pvLimit = 0) {
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
      if (evaluationAfter !== null || positionAfter) {
        let evaluationComment = "";

        evaluationAfter =
          Math.round(
            100 *
              (evaluationAfter !== null
                ? evaluationAfter
                : positionAfter[0].evaluation)
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
        if (evaluationBefore !== null || positionBefore) {
          evaluationBefore =
            Math.round(
              100 *
                (evaluationBefore !== null
                  ? evaluationBefore
                  : positionBefore[0].evaluation)
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
      if (positionBefore) {
        let position = positionBefore[0];
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

    saveEvalComments(pvLimit = 0, plies = this.plies) {
      const messages = {};
      plies.forEach((ply) => {
        const notes = [];
        const evaluations = this.getEvalComments(ply, pvLimit);
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
      if (this.bot && this.bot.status.analyzingPly) {
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.bot.status.analyzingPly.id,
          isDone: this.bot.status.analyzingPly.isDone,
        });
      }
    },
  },

  mounted() {
    let bot;

    bot = new TiltakCloud({
      onInit: this.addBot,
      onError: this.notifyError,
    });
    this.$set(this.bots, bot.id, bot);

    bot = new TiltakWasm({
      onInit: this.addBot,
      onError: this.notifyError,
    });
    this.$set(this.bots, bot.id, bot);

    bot = new TopazWasm({
      onInit: this.addBot,
      onError: this.notifyError,
    });
    this.$set(this.bots, bot.id, bot);

    bot = new TeiBot({
      onInit: this.addBot,
      onError: this.notifyError,
    });
    this.$set(this.bots, bot.id, bot);
  },

  watch: {
    "bot.status.isEnabled"(isEnabled) {
      if (this.bot.isInteractive) {
        if (isEnabled) {
          this.bot.analyzePosition();
        } else {
          this.bot.terminate();
        }
      }
    },
    tps() {
      if (this.bot.isInteractive && this.bot.status.isEnabled) {
        this.bot.analyzePosition();
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
