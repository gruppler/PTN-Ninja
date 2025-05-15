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
                  prefix="ws://"
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
                  :disable="teiBot.isConnected || teiBot.isConnecting"
                />
              </div>
            </q-item>
            <q-item tag="label" clickable v-ripple>
              <q-item-section side>
                <q-checkbox v-model="botSettings.tei.log" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("tei.log") }}</q-item-label>
              </q-item-section>
            </q-item>
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
            :disabled="
              !botSettings.tei.address || botSettings.tei.port === null
            "
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
import { cloneDeep, uniq } from "lodash";
import asyncPool from "tiny-async-pool";
import Ply from "../../Game/PTN/Ply";
import { deepFreeze } from "../../utilities";
import AnalysisItem from "../database/AnalysisItem";
import PlyChip from "../PTN/Ply.vue";

const bestMoveEndpoint =
  "https://tdp04uo1d9.execute-api.eu-north-1.amazonaws.com/tiltak";

export default {
  name: "BotSuggestions",
  components: { AnalysisItem, PlyChip },
  data() {
    return {
      loadingTiltakMoves: false,
      loadingTiltakAnalysis: false,
      progressTiltakAnalysis: 0,
      loadingTopazMoves: false,
      progressTopazAnalysis: 0,
      tiltakInteractive: {
        isEnabled: false,
        isLoading: false,
        isReady: false,
        time: null,
        nps: null,
        tps: null,
        nextTPS: null,
        komi: null,
        size: null,
        initTPS: null,
      },
      teiBot: {
        isConnecting: false,
        isConnected: false,
        isEnabled: false,
        isLoading: false,
        isReady: false,
        time: null,
        nps: null,
        tps: null,
        nextTPS: null,
        komi: null,
        size: null,
        initTPS: null,
        name: null,
        author: null,
      },
      topazTimer: null,
      showBotSettings: false,
      analyzingPly: null,
      positions: {},
      suggestions: [],
      bots: ["tiltak-cloud"],
      botSettings: cloneDeep(this.$store.state.ui.botSettings),
      botThinkBudgetInSeconds: {
        short: 5,
        long: 10,
      },
      botSettingsKey: this.getBotSettingsKey(this.$store.state.ui.botSettings),
      sections: cloneDeep(this.$store.state.ui.analysisSections),
      tiltakWorker: null,
      topazWorker: null,
      teiSocket: null,
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
    game() {
      return this.$store.state.game;
    },
    tps() {
      return this.$store.state.game.position.tps;
    },
    teiPosition() {
      return this.game.ptn.tags.tps ? this.game.ptn.tags.tps.text : null;
    },
    teiMoves() {
      return this.game.ptn.branchPlies
        .slice(
          0,
          1 + this.game.position.plyIndex - 1 * !this.game.position.plyIsDone
        )
        .map((ply) => ply.text)
        .join(" ");
    },
    isGameEnd() {
      return (
        this.$store.state.game.position.isGameEnd &&
        !this.$store.state.game.position.isGameEndDefault
      );
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

    nextPly(player, color) {
      if (player === 2 && color === 1) {
        return { player: 1, color: 1 };
      }
      return { player: player === 1 ? 2 : 1, color: color === 1 ? 2 : 1 };
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

    //#region Tiltak Cloud

    async analyzeGameTiltak() {
      if (this.isOffline || !this.game.ptn.branchPlies.length) {
        this.notifyError("Offline");
        return;
      }
      try {
        this.loadingTiltakAnalysis = true;
        this.progressTiltakAnalysis = 0;
        const concurrency = 10;
        const komi = this.game.config.komi;
        const secondsToThinkPerPly = this.botThinkBudgetInSeconds.short;
        const plies = this.plies.filter((ply) => !this.plyHasEvalComment(ply));
        const settingsKey = this.botSettingsKey;
        let positions = plies.map((ply) => ply.tpsBefore);
        plies.forEach((ply) => {
          if (!ply.result || ply.result.type === "1") {
            positions.push(ply.tpsAfter);
          }
        });
        positions = uniq(positions).filter(
          (tps) =>
            !(tps in this.positions) || !(settingsKey in this.positions[tps])
        );
        let total = positions.length;
        let completed = 0;

        for await (const result of asyncPool(concurrency, positions, (tps) =>
          this.queryBotSuggestionsTiltak(
            secondsToThinkPerPly,
            tps,
            komi,
            settingsKey
          ).catch((error) => {
            console.error("Failed to query position", {
              tps,
              komi,
              secondsToThinkPerPly,
              error,
            });
          })
        )) {
          this.progressTiltakAnalysis = (100 * ++completed) / total;
        }
        // Insert comments
        this.saveEvalComments(
          this.botSettings["tiltak-cloud"].pvLimit,
          plies,
          settingsKey
        );
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loadingTiltakAnalysis = false;
      }
    },

    async analyzePositionTilTak(secondsToThink) {
      try {
        this.loadingTiltakMoves = true;
        this.analyzingPly = this.$store.state.game.position.boardPly;
        const tps = this.tps;
        const komi = this.game.config.komi;
        await this.queryBotSuggestionsTiltak(secondsToThink, tps, komi);
      } catch (error) {
        this.console.error("Failed to query position", {
          tps,
          komi,
          secondsToThink,
          error,
        });
      } finally {
        this.loadingTiltakMoves = false;
      }
    },

    async queryBotSuggestionsTiltak(
      secondsToThink,
      tps,
      komi,
      settingsKey = this.botSettingsKey
    ) {
      if (this.isOffline) {
        this.notifyError("Offline");
        return;
      }
      if (!tps) {
        throw new Error("Missing TPS");
      }
      const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
      const initialColor =
        this.game.config.openingSwap && moveNumber === 1
          ? initialPlayer == 1
            ? 2
            : 1
          : initialPlayer;
      const response = await fetch(bestMoveEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          komi: komi,
          size: this.game.config.size,
          tps,
          moves: [],
          time_control: {
            // FixedNodes: 100000, // can be used instead of `Time`
            Time: [
              { secs: secondsToThink, nanos: 0 }, // time budget for endpoint
              { secs: 0, nanos: 0 }, // increment, ignored
            ],
          },
          rollout_depth: 0,
          rollout_temperature: 0.25,
          action: "SuggestMoves",
        }),
      });
      if (!response.ok) {
        return this.notifyError("HTTP-Error: " + response.status);
      }
      const data = await response.json();
      const { SuggestMoves: suggestedMoves } = data;

      const result = suggestedMoves.map(
        ({ mv: ptn, visits, winning_probability, pv }) => {
          let player = initialPlayer;
          let color = initialColor;
          let ply = new Ply(ptn, { id: null, player, color });
          let followingPlies = pv.map((ply) => {
            ({ player, color } = this.nextPly(player, color));
            return new Ply(ply, { id: null, player, color });
          });
          let evaluation = 200 * (winning_probability - 0.5);
          return { ply, followingPlies, visits, evaluation, secondsToThink };
        }
      );
      deepFreeze(result);
      this.$set(this.positions, tps, {
        ...(this.positions[tps] || {}),
        [settingsKey]: result,
      });
      return result;
    },

    //#region Tiltak WASM

    initTiltakInteractive(force = false) {
      if (force || !this.tiltakWorker) {
        try {
          this.tiltakWorker = new Worker(
            new URL("/tiltak-wasm/tiltak.worker.js", import.meta.url)
          );

          // Error handling
          this.tiltakWorker.onerror = (error) => {
            console.info(
              "Tiltak (wasm) worker encountered an error. Restarting...",
              error.message
            );
            this.notifyError(error);
            if (this.tiltakWorker) {
              this.tiltakWorker.terminate();
              this.tiltakWorker = null;
            }
            this.tiltakInteractive.isLoading = false;
            this.tiltakInteractive.isReady = false;
            this.tiltakInteractive.time = null;
            this.tiltakInteractive.nps = null;
            this.tiltakInteractive.tps = null;
            this.tiltakInteractive.nextTPS = null;
            this.tiltakInteractive.komi = null;
            this.tiltakInteractive.size = null;
            this.tiltakInteractive.initTPS = null;
          };

          // Message handling
          this.tiltakWorker.onmessage = ({ data }) => {
            if (data === "teiok" || data === "readyok") {
              this.tiltakInteractive.isReady = true;
            }
            this.receiveTiltakInteractiveSuggestions(data);
          };

          // Init
          this.tiltakWorker.postMessage("isready");
          this.bots = uniq(this.bots.concat(["tiltak"])).sort();
          return true;
        } catch (error) {
          console.error("Failed to load Tiltak (wasm):", error);
          return false;
        }
      }
    },

    async requestTiltakInteractiveSuggestions() {
      if (!this.tiltakWorker) {
        this.initTiltakInteractive();
        return;
      }

      // Send `stop` even if unnecessary
      this.tiltakWorker.postMessage("stop");

      // Pause if game has ended
      if (this.isGameEnd) {
        this.tiltakInteractive.time = 0;
        this.tiltakInteractive.nps = 0;
        this.tiltakInteractive.nextTPS = null;
        return;
      }

      // Abort if worker is not responding
      if (!this.tiltakInteractive.isReady) {
        console.error("Tiltak worker failed to initialize");
        return;
      }

      // Send `teinewgame` if necessary
      if (
        this.tiltakInteractive.size !== this.game.config.size ||
        this.tiltakInteractive.komi !== this.game.config.komi ||
        this.tiltakInteractive.initTPS !== this.teiPosition
      ) {
        this.tiltakWorker.postMessage(`teinewgame ${this.game.config.size}`);
        this.tiltakWorker.postMessage(
          `setoption name HalfKomi value ${this.game.config.komi * 2}`
        );
        this.tiltakInteractive.size = this.game.config.size;
        this.tiltakInteractive.komi = this.game.config.komi;
        this.tiltakInteractive.initTPS = this.teiPosition;
      }

      // Queue current position for pairing with future response
      this.tiltakInteractive.nextTPS = this.tps;
      if (!this.tiltakInteractive.tps) {
        this.tiltakInteractive.tps = this.tiltakInteractive.nextTPS;
      }

      // Send current position
      let posMessage = "position";
      if (this.tiltakInteractive.initTPS) {
        posMessage += " tps " + this.tiltakInteractive.initTPS;
      } else {
        posMessage += " startpos";
      }
      if (this.teiMoves) {
        posMessage += " moves " + this.teiMoves;
      }
      this.tiltakWorker.postMessage(posMessage);
      this.tiltakWorker.postMessage(`go infinite`);
      this.tiltakInteractive.isLoading = true;
    },

    receiveTiltakInteractiveSuggestions(result) {
      if (result.error) {
        this.notifyError(result.error);
        return;
      }

      const results = {
        pv: [],
        time: null,
        nps: null,
        depth: null,
        seldepth: null,
        score: null,
        nodes: null,
      };
      if (result.startsWith("bestmove")) {
        // Search ended
        this.tiltakInteractive.isLoading = false;
        this.tiltakInteractive.nps = 0;
        if (this.tiltakInteractive.tps === this.tiltakInteractive.nextTPS) {
          // No position queued
          this.tiltakInteractive.tps = null;
          this.tiltakInteractive.nextTPS = null;
        } else {
          this.tiltakInteractive.tps = this.tiltakInteractive.nextTPS;
        }
        return;
      } else if (result.startsWith("info")) {
        // Parse Results
        this.tiltakInteractive.isLoading = true;
        const keys = [
          "pv",
          "time",
          "nps",
          "depth",
          "seldepth",
          "score",
          "nodes",
        ];
        let key = "";
        for (const value of result.split(" ")) {
          if (keys.includes(value)) {
            key = value;
          } else {
            if (key === "pv") {
              results.pv.push(value);
            } else {
              results[key] = Number(value);
            }
          }
        }
        // Ignore other `info` messages
        if (!results.pv.length) {
          return;
        }
      } else {
        // Ignore all other messages
        return;
      }

      if (!this.tiltakInteractive.tps) {
        this.tiltakInteractive.tps = this.tps;
      }
      const id = this.getBotSettingsKey({ bot: "tiltak" });
      const tps = this.tiltakInteractive.tps;

      // Update time and nps
      if (!this.isGameEnd) {
        this.tiltakInteractive.time = results.time;
        this.tiltakInteractive.nps = results.nps;
      }

      // Determine ply colors
      const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
      const initialColor =
        this.game.config.openingSwap && moveNumber === 1
          ? initialPlayer == 1
            ? 2
            : 1
          : initialPlayer;
      let player = initialPlayer;
      let color = initialColor;
      const ply = new Ply(results.pv.splice(0, 1)[0], {
        id: null,
        player,
        color,
      });
      const followingPlies = results.pv.map((ply) => {
        ({ player, color } = this.nextPly(player, color));
        return new Ply(ply, { id: null, player, color });
      });
      const evaluation = results.score * (initialPlayer === 1 ? 1 : -1);
      const depth = results.depth;
      const nodes = results.nodes;
      const suggestions = [{ ply, followingPlies, evaluation, depth, nodes }];
      deepFreeze(suggestions);
      if (
        !this.positions[tps] ||
        !this.positions[tps][id] ||
        this.positions[tps][id][0].depth < suggestions[0].depth
      ) {
        // Don't overwrite deeper searches for this position
        this.$set(this.positions, tps, {
          ...(this.positions[tps] || {}),
          [id]: suggestions,
        });
        return suggestions;
      }
    },

    async terminateTiltakInteractive() {
      if (this.tiltakWorker && this.tiltakInteractive.isLoading) {
        try {
          this.tiltakWorker.postMessage("stop");
          this.tiltakInteractive.isLoading = false;
          this.tiltakInteractive.nps = null;
          this.tiltakInteractive.tps = null;
          this.tiltakInteractive.nextTPS = null;
        } catch (error) {
          await this.tiltakWorker.terminate();
          this.initTiltakInteractive();
        }
      }
    },

    //#region TEI

    async initTei(force = false) {
      if (force || !this.teiBot.isConnected) {
        try {
          return await new Promise((resolve, reject) => {
            const url = `ws://${this.botSettings.tei.address}:${this.botSettings.tei.port}/`;
            this.teiBot.isConnecting = true;
            this.teiSocket = new WebSocket(url);
            this.teiSocket.onopen = () => {
              this.teiBot.isConnecting = false;
              this.teiBot.isConnected = true;
              console.info(`Connected to ${url}`);
              this.sendTei("tei");
              resolve(true);
            };
            this.teiSocket.onclose = () => {
              console.info(`Disconnected from ${url}`);
              this.teiBot.isEnabled = false;
              this.teiBot.isConnecting = false;
              this.teiBot.isConnected = false;
              this.teiBot.isLoading = false;
              this.teiBot.isReady = false;
              this.teiBot.time = null;
              this.teiBot.nps = null;
              this.teiBot.tps = null;
              this.teiBot.nextTPS = null;
              this.teiBot.komi = null;
              this.teiBot.size = null;
              this.teiBot.initTPS = null;
              this.teiBot.name = null;
              this.teiBot.author = null;
            };

            // Error handling
            this.teiSocket.onerror = (error) => {
              this.teiBot.isEnabled = false;
              this.teiBot.isConnecting = false;
              this.teiBot.isConnected = false;
              this.teiBot.isLoading = false;
              this.teiBot.isReady = false;
              this.teiBot.time = null;
              this.teiBot.nps = null;
              this.teiBot.tps = null;
              this.teiBot.nextTPS = null;
              this.teiBot.komi = null;
              this.teiBot.size = null;
              this.teiBot.initTPS = null;
              this.teiBot.name = null;
              this.teiBot.author = null;
              reject(error);
            };

            // Message handling
            this.teiSocket.onmessage = ({ data }) => {
              if (this.botSettings.tei.log) {
                console.info(`ws>: ${data}`);
              }
              if (data === "teiok" || data === "readyok") {
                this.teiBot.isReady = true;
                if (this.teiBot.isEnabled) {
                  this.requestTeiSuggestions();
                }
              }
              if (data.startsWith("id name ")) {
                this.teiBot.name = data.substr(8);
              }
              if (data.startsWith("id author ")) {
                this.teiBot.author = data.substr(10);
              }
              this.receiveTeiSuggestions(data);
            };
          });
        } catch (error) {
          return false;
        }
      }
    },

    sendTei(message) {
      if (this.teiSocket) {
        if (this.botSettings.tei.log) {
          console.info(`>ws: ${message}`);
        }
        this.teiSocket.send(message);
      }
    },

    async requestTeiSuggestions() {
      if (!this.teiSocket) {
        this.initTei();
        return;
      }

      // Send `stop` even if unnecessary
      this.sendTei("stop");

      // Pause if game has ended
      if (this.isGameEnd) {
        this.teiBot.time = 0;
        this.teiBot.nps = 0;
        this.teiBot.nextTPS = null;
        return;
      }

      // Abort if worker is not responding
      if (!this.teiBot.isReady) {
        console.error("TEI bot is not ready");
        return;
      }

      // Send `teinewgame` if necessary
      if (
        this.teiBot.size !== this.game.config.size ||
        this.teiBot.komi !== this.game.config.komi ||
        this.teiBot.initTPS !== this.teiPosition
      ) {
        this.sendTei(`teinewgame ${this.game.config.size}`);
        this.sendTei(
          `setoption name HalfKomi value ${this.game.config.komi * 2}`
        );
        this.teiBot.size = this.game.config.size;
        this.teiBot.komi = this.game.config.komi;
        this.teiBot.initTPS = this.teiPosition;
      }

      // Queue current position for pairing with future response
      this.teiBot.nextTPS = this.tps;
      if (!this.teiBot.tps) {
        this.teiBot.tps = this.teiBot.nextTPS;
      }

      // Send current position
      let posMessage = "position";
      if (this.teiBot.initTPS) {
        posMessage += " tps " + this.teiBot.initTPS;
      } else {
        posMessage += " startpos moves ";
      }
      if (this.teiMoves) {
        posMessage += this.teiMoves;
      }
      this.sendTei(posMessage);
      this.sendTei(`go infinite`);
      this.teiBot.isLoading = true;
    },

    receiveTeiSuggestions(result) {
      if (result.error) {
        this.notifyError(result.error);
        return;
      }

      const results = {
        pv: [],
        time: null,
        nps: null,
        depth: null,
        seldepth: null,
        score: null,
        nodes: null,
      };
      if (result.startsWith("bestmove")) {
        // Search ended
        this.teiBot.isLoading = false;
        this.teiBot.nps = 0;
        if (this.teiBot.tps === this.teiBot.nextTPS) {
          // No position queued
          this.teiBot.tps = null;
          this.teiBot.nextTPS = null;
        } else {
          this.teiBot.tps = this.teiBot.nextTPS;
        }
        return;
      } else if (result.startsWith("info")) {
        // Parse Results
        this.teiBot.isLoading = true;
        const keys = [
          "pv",
          "time",
          "nps",
          "depth",
          "seldepth",
          "score",
          "nodes",
        ];
        let key = "";
        for (const value of result.split(" ")) {
          if (keys.includes(value)) {
            key = value;
          } else {
            if (key === "pv") {
              results.pv.push(value);
            } else {
              results[key] = Number(value);
            }
          }
        }
        // Ignore other `info` messages
        if (!results.pv.length) {
          return;
        }
      } else {
        // Ignore all other messages
        return;
      }

      if (!this.teiBot.tps) {
        this.teiBot.tps = this.tps;
      }
      const id = this.getBotSettingsKey({ bot: "tei" });
      const tps = this.teiBot.tps;

      // Update time and nps
      if (!this.isGameEnd) {
        this.teiBot.time = results.time;
        this.teiBot.nps = results.nps;
      }

      // Determine ply colors
      const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
      const initialColor =
        this.game.config.openingSwap && moveNumber === 1
          ? initialPlayer == 1
            ? 2
            : 1
          : initialPlayer;
      let player = initialPlayer;
      let color = initialColor;
      const ply = new Ply(results.pv.splice(0, 1)[0], {
        id: null,
        player,
        color,
      });
      const followingPlies = results.pv.map((ply) => {
        ({ player, color } = this.nextPly(player, color));
        return new Ply(ply, { id: null, player, color });
      });
      const evaluation = results.score * (initialPlayer === 1 ? 1 : -1);
      const depth = results.depth;
      const nodes = results.nodes;
      const suggestions = [{ ply, followingPlies, evaluation, depth, nodes }];
      deepFreeze(suggestions);
      if (
        !this.positions[tps] ||
        !this.positions[tps][id] ||
        this.positions[tps][id][0].depth < suggestions[0].depth
      ) {
        // Don't overwrite deeper searches for this position
        this.$set(this.positions, tps, {
          ...(this.positions[tps] || {}),
          [id]: suggestions,
        });
        return suggestions;
      }
    },

    async terminateTei() {
      if (this.teiSocket) {
        try {
          if (this.teiBot.isConnected) {
            this.sendTei("stop");
          }
          this.teiBot.isLoading = false;
          this.teiBot.nps = null;
          this.teiBot.tps = null;
          this.teiBot.nextTPS = null;
        } catch (error) {
          await this.teiSocket.close();
          this.initTei();
        }
      }
    },

    disconnectTei() {
      if (this.teiSocket && this.teiBot.isConnected) {
        this.teiSocket.close();
        this.teiSocket = null;
      }
    },

    //#region Topaz

    initTopaz(force = false) {
      if (force || !this.topazWorker) {
        try {
          this.topazWorker = new Worker(
            new URL("/topaz/topaz.worker.js", import.meta.url)
          );
          this.topazWorker.onmessage = ({ data }) => {
            this.receiveTopazSuggestions(data);
          };
          this.bots = uniq(this.bots.concat(["topaz"])).sort();
          return true;
        } catch (error) {
          console.error("Failed to load Topaz (wasm):", error);
          return false;
        }
      }
    },

    async requestTopazSuggestions() {
      if (!this.topazWorker) {
        this.initTopaz();
        return;
      }
      if (this.loadingTopazMoves) {
        return;
      }
      this.analyzingPly = this.$store.state.game.position.boardPly;
      this.loadingTopazMoves = true;
      this.progressTopazAnalysis = 0;
      const startTime = new Date().getTime();
      const timeBudget = this.botSettings.topaz.timeBudget * 10;
      this.topazTimer = setInterval(() => {
        this.progressTopazAnalysis =
          (new Date().getTime() - startTime) / timeBudget;
      }, 1000);
      this.topazWorker.postMessage({
        ...this.botSettings.topaz,
        size: this.game.config.size,
        komi: this.game.config.komi,
        tps: this.tps,
        id: this.botSettingsKey,
      });
    },

    receiveTopazSuggestions(result) {
      this.loadingTopazMoves = false;
      clearInterval(this.topazTimer);
      this.topazTimer = null;

      if (result.error) {
        this.notifyError(result.error);
        return;
      }

      const { tps, depth, score, nodes, pv, id } = result;
      const [initialPlayer, moveNumber] = tps.split(" ").slice(1).map(Number);
      const initialColor =
        this.game.config.openingSwap && moveNumber === 1
          ? initialPlayer == 1
            ? 2
            : 1
          : initialPlayer;
      let player = initialPlayer;
      let color = initialColor;
      const ply = new Ply(pv.splice(0, 1)[0], {
        id: null,
        player,
        color,
      });
      const followingPlies = pv.map((ply) => {
        ({ player, color } = this.nextPly(player, color));
        return new Ply(ply, { id: null, player, color });
      });
      const suggestions = [{ ply, followingPlies, depth, score, nodes }];
      deepFreeze(suggestions);
      this.$set(this.positions, tps, {
        ...(this.positions[tps] || {}),
        [id]: suggestions,
      });
      return suggestions;
    },

    async terminateTopaz() {
      if (this.topazWorker && this.loadingTopazMoves) {
        try {
          await this.topazWorker.terminate();
          clearInterval(this.topazTimer);
          this.loadingTopazMoves = false;
          this.topazTimer = null;
          this.analyzingPly = null;
          this.topazWorker = null;
          this.initTopaz();
        } catch (error) {
          this.notifyError(error);
        }
      }
    },

    //#region Init

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
