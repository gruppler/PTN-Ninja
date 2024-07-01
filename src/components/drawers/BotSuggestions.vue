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

      <smooth-reflow class="bg-ui">
        <template v-if="showBotSettings">
          <!-- Bot -->
          <q-select
            v-model="botSettings.bot"
            :options="bots"
            :label="$t('Bot')"
            behavior="menu"
            transition-show="none"
            transition-hide="none"
            emit-value
            map-options
            item-aligned
            filled
          >
            <template v-slot:prepend>
              <q-icon name="bot" />
            </template>
          </q-select>

          <template v-if="botSettings.bot === 'tiltak'">
            <!-- Max Suggestions -->
            <q-input
              v-model.number="botSettings.maxSuggestedMoves"
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
          <template v-if="botSettings.bot === 'topaz'">
            <!-- Depth -->
            <q-input
              v-model.number="botSettings.depth"
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
              v-model.number="botSettings.timeBudget"
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
        </template>
      </smooth-reflow>

      <smooth-reflow>
        <template v-if="botSettings.bot === 'tiltak'">
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
            v-if="!botMoves.length && !isGameEnd"
            @click="analyzePositionTilTak(botThinkBudgetInSeconds.short)"
            :loading="loadingTiltakMoves"
            class="full-width"
            color="primary"
            icon="board"
            :label="$t('analysis.Analyze Position')"
            :no-caps="loadingTiltakMoves"
            stretch
          >
            <template v-slot:loading>
              <PlyChip
                v-if="analyzingPly"
                :ply="allPlies[analyzingPly.id]"
                @click.stop.capture="goToAnalysisPly"
                no-branches
                :done="analyzingPly.isDone"
              />
              <q-spinner />
            </template>
          </q-btn>
        </template>
        <template v-else-if="botSettings.bot === 'topaz'">
          <q-btn
            v-if="!botMoves.length && !isGameEnd"
            @click="requestTopazSuggestions()"
            :loading="loadingTopazMoves"
            :percentage="progressTopazAnalysis"
            class="full-width"
            color="primary"
            icon="board"
            :label="$t('analysis.Analyze Position')"
            :no-caps="loadingTopazMoves"
            stretch
          >
            <template v-slot:loading>
              <PlyChip
                v-if="analyzingPly"
                :ply="allPlies[analyzingPly.id]"
                @click.stop.capture="goToAnalysisPly"
                no-branches
                :done="analyzingPly.isDone"
              />
              <q-spinner />
              <q-btn
                :label="$t('Cancel')"
                @click.stop.capture="terminateTopaz"
                flat
              />
            </template>
          </q-btn>
        </template>
      </smooth-reflow>

      <smooth-reflow>
        <AnalysisItem
          v-for="(move, i) in botMoves.slice(0, botSettings.maxSuggestedMoves)"
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
          :middle-number="
            'depth' in move ? `${$t('analysis.depth')} ${move.depth}` : null
          "
        />

        <q-item v-if="isGameEnd" class="flex-center">
          {{ $t("analysis.gameOver") }}
        </q-item>
      </smooth-reflow>

      <smooth-reflow>
        <q-btn
          v-if="
            botSettings.bot === 'tiltak' &&
            botMoves.length &&
            botMoves.every(
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
      </smooth-reflow>
    </q-expansion-item>
  </div>
</template>

<script>
import AnalysisItem from "../database/AnalysisItem";
import PlyChip from "../PTN/Ply.vue";
import Ply from "../../Game/PTN/Ply";
import { deepFreeze } from "../../utilities";
import { pick, uniq } from "lodash";
import asyncPool from "tiny-async-pool";

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
      topazTimer: null,
      showBotSettings: false,
      analyzingPly: null,
      botPositions: {},
      botMoves: [],
      bots: ["tiltak", "topaz"].map((value) => ({
        value,
        label: this.$t(`analysis.bots.${value}`),
      })),
      botSettings: { ...this.$store.state.ui.botSettings },
      botThinkBudgetInSeconds: {
        short: 5,
        long: 10,
      },
      botSettingsHash: this.hashBotSettings(this.$store.state.ui.botSettings),
      sections: { ...this.$store.state.ui.analysisSections },
    };
  },
  computed: {
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
    isGameEnd() {
      return (
        this.$store.state.game.position.isGameEnd &&
        !this.$store.state.game.position.isGameEndDefault
      );
    },
    botPosition() {
      return this.botPositions[this.tps] || null;
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
    hashBotSettings(settings) {
      if (settings.bot === "tiltak") {
        return Object.values(pick(settings, ["bot"])).join(",");
      } else {
        return Object.values(
          pick(settings, ["bot", "depth", "timeBudget"])
        ).join(",");
      }
    },

    nextPly(player, color) {
      if (player === 2 && color === 1) {
        return { player: 1, color: 1 };
      }
      return { player: player === 1 ? 2 : 1, color: color === 1 ? 2 : 1 };
    },

    formatEvaluation(v) {
      return `+${this.$n(Math.abs(v), "n2")}%`;
    },

    plyHasEvalComment(ply) {
      return (
        ply.id in this.game.comments.notes &&
        this.game.comments.notes[ply.id].some(
          (comment) => comment.evaluation !== null
        )
      );
    },
    plyHasPVComment(ply, pv = null) {
      return (
        ply.id in this.game.comments.notes &&
        this.game.comments.notes[ply.id].some((comment) =>
          pv === null ? comment.pv : comment.message === pv
        )
      );
    },
    getEvalComments(ply, settingsHash) {
      let comments = [];
      let positionBefore = this.botPositions[ply.tpsBefore];
      let positionAfter = this.botPositions[ply.tpsAfter];
      let evaluationBefore = null;
      let evaluationAfter = null;

      // Assume evaluationAfter from game result
      if (ply.result && ply.result.type !== "1") {
        evaluationAfter = ply.result.isTie
          ? 0
          : 100 * (ply.result.winner === 1 ? 1 : -1);
      }

      // Get evaulationBefore from existing eval comment of previous ply
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

      if (
        evaluationAfter !== null ||
        (positionAfter && settingsHash in positionAfter)
      ) {
        evaluationAfter =
          Math.round(
            100 *
              (evaluationAfter !== null
                ? evaluationAfter
                : positionAfter[settingsHash][0].evaluation)
          ) / 1e4;
        comments.push(`${evaluationAfter >= 0 ? "+" : ""}${evaluationAfter}`);
        if (
          evaluationBefore !== null ||
          (positionBefore && settingsHash in positionBefore)
        ) {
          evaluationBefore =
            Math.round(
              100 *
                (evaluationBefore !== null
                  ? evaluationBefore
                  : positionBefore[settingsHash][0].evaluation)
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
      return comments;
    },
    getPVComment(ply, settingsHash) {
      let positionBefore = this.botPositions[ply.tpsBefore];
      if (positionBefore && settingsHash in positionBefore) {
        let position = positionBefore[settingsHash][0];
        if (position && position.ply) {
          let pv = [position.ply, ...position.followingPlies]
            .slice(0, 3)
            .map((ply) => ply.ptn);
          return `pv ${pv.join(" ")}`;
        }
      }
      return null;
    },

    async analyzeGameTiltak() {
      if (this.isOffline || !this.game.ptn.branchPlies.length) {
        this.notifyError("Offline");
        return;
      }
      try {
        this.loadingTiltakAnalysis = true;
        this.progressTiltakAnalysis = 0;
        const concurrency = 10; // TODO: determine ideal value
        const komi = this.game.config.komi;
        const secondsToThinkPerPly = this.botThinkBudgetInSeconds.short;
        const plies = this.plies.filter((ply) => !this.plyHasEvalComment(ply));
        const settingsHash = this.botSettingsHash;
        let positions = plies.map((ply) => ply.tpsBefore);
        plies.forEach((ply) => {
          if (!ply.result || ply.result.type === "1") {
            positions.push(ply.tpsAfter);
          }
        });
        positions = uniq(positions).filter(
          (tps) =>
            !(tps in this.botPositions) ||
            !(settingsHash in this.botPositions[tps])
        );
        let total = positions.length;
        let completed = 0;

        for await (const result of asyncPool(concurrency, positions, (tps) =>
          this.queryBotSuggestionsTiltak(
            secondsToThinkPerPly,
            tps,
            komi,
            settingsHash
          ).catch((error) => {
            console.error("Failed to query position", {
              tps,
              komi,
              secondsToThink,
              error,
            });
          })
        )) {
          this.progressTiltakAnalysis = (100 * ++completed) / total;
        }
        // Insert comments
        let messages = {};
        plies.forEach((ply) => {
          let notes = [];
          let evaluations = this.getEvalComments(ply, settingsHash);
          if (evaluations.length) {
            notes.push(...evaluations);
          }
          let pv = this.getPVComment(ply, settingsHash);
          if (pv !== null && !this.plyHasPVComment(ply, pv)) {
            notes.push(pv);
          }
          messages[ply.id] = notes;
        });
        this.$store.dispatch("game/ADD_NOTES", messages);
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loadingTiltakAnalysis = false;
      }
    },
    async analyzePositionTilTak(secondsToThink) {
      if (this.isGameEnd) {
        return;
      }
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
      settingsHash = this.botSettingsHash
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
      this.$set(this.botPositions, tps, {
        ...(this.botPositions[tps] || {}),
        [settingsHash]: result,
      });
      return result;
    },

    async requestTopazSuggestions() {
      if (!this.topazWorker) {
        try {
          await this.init();
        } catch (error) {
          return;
        }
      }
      if (this.loadingTopazMoves) {
        return;
      }
      this.analyzingPly = this.$store.state.game.position.boardPly;
      this.loadingTopazMoves = true;
      this.progressTopazAnalysis = 0;
      const startTime = new Date().getTime();
      const timeBudget = this.botSettings.timeBudget * 10;
      this.topazTimer = setInterval(() => {
        this.progressTopazAnalysis =
          (new Date().getTime() - startTime) / timeBudget;
      }, 1000);
      this.topazWorker.postMessage({
        ...this.botSettings,
        size: this.game.config.size,
        komi: this.game.config.komi,
        tps: this.tps,
        id: this.botSettingsHash,
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
      let ply = new Ply(pv.splice(0, 1)[0], { id: null, player, color });
      let followingPlies = pv.map((ply) => {
        ({ player, color } = this.nextPly(player, color));
        return new Ply(ply, { id: null, player, color });
      });
      let botMoves = [{ ply, followingPlies, depth, score, nodes }];
      deepFreeze(botMoves);
      this.$set(this.botPositions, tps, {
        ...(this.botPositions[tps] || {}),
        [id]: botMoves,
      });
      return botMoves;
    },

    goToAnalysisPly() {
      if (this.analyzingPly) {
        this.$store.dispatch("game/GO_TO_PLY", {
          plyID: this.analyzingPly.id,
          isDone: this.analyzingPly.isDone,
        });
      }
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
          this.init();
        } catch (error) {
          this.notifyError(error);
        }
      }
    },

    async init() {
      // Load wasm bots
      try {
        if (!this.topazWorker) {
          try {
            this.topazWorker = new Worker(
              new URL("/topaz/topaz.worker.js", import.meta.url)
            );
            this.topazWorker.onmessage = ({ data }) => {
              this.receiveTopazSuggestions(data);
            };
          } catch (error) {
            this.notifyError("Bot unavailable");
          }
        }
      } catch (error) {
        this.notifyError(error);
      }
    },
  },

  async mounted() {
    await this.init();
  },

  watch: {
    async isOffline(isOffline) {
      if (!isOffline && this.isPanelVisible) {
        if (!this.topazWorker) {
          await this.init();
        }
      }
    },
    async isPanelVisible(isPanelVisible) {
      if (isPanelVisible) {
        if (!this.topazWorker) {
          await this.init();
        }
      }
    },
    botPosition(position) {
      if (position) {
        if (this.botSettingsHash in position) {
          this.botMoves = position[this.botSettingsHash] || [];
        } else {
          this.botMoves = [];
        }
      } else {
        this.botMoves = [];
      }
    },
    botSettingsHash(hash) {
      if (this.botPosition && hash in this.botPosition) {
        this.botMoves = this.botPosition[hash] || [];
      } else {
        this.botMoves = [];
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
        this.$store.dispatch("ui/SET_UI", ["botSettings", settings]);
        this.botSettingsHash = this.hashBotSettings(settings);
      },
      deep: true,
    },
  },
};
</script>
