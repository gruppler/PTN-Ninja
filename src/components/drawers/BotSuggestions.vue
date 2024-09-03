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

          <template v-if="botSettings.bot === 'tiltak-cloud'">
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
                {{ $t("analysis.seconds_unit") }}
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
      </smooth-reflow>

      <!-- Results -->
      <smooth-reflow>
        <AnalysisItem
          v-for="(move, i) in suggestions.slice(
            0,
            botSettings.maxSuggestedMoves
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
        />

        <q-item v-if="isGameEnd" class="flex-center">
          {{ $t("analysis.gameOver") }}
        </q-item>
      </smooth-reflow>

      <!-- Secondary Controls -->
      <smooth-reflow>
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
      </smooth-reflow>
    </q-expansion-item>
  </div>
</template>

<script>
import { pick, uniq } from "lodash";
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
        time: null,
        nps: null,
        tps: null,
        nextTPS: null,
        komi: null,
        size: null,
        initTPS: null,
      },
      topazTimer: null,
      showBotSettings: false,
      analyzingPly: null,
      positions: {},
      suggestions: [],
      bots: ["tiltak-cloud"],
      botSettings: { ...this.$store.state.ui.botSettings },
      botThinkBudgetInSeconds: {
        short: 5,
        long: 10,
      },
      botSettingsHash: this.hashBotSettings(this.$store.state.ui.botSettings),
      sections: { ...this.$store.state.ui.analysisSections },
      tiltakWorker: null,
      topazWorker: null,
    };
  },
  computed: {
    botOptions() {
      return this.bots.map((value) => ({
        value,
        label: this.$t(`analysis.bots.${value}`),
        description: this.$t(`analysis.bots_description.${value}`),
        icon: value.endsWith("-cloud") ? "online" : "local",
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

    hashBotSettings(settings) {
      if (settings.bot === "tiltak-cloud") {
        return Object.values(pick(settings, ["bot"])).join(",");
      } else if (settings.bot === "tiltak") {
        return settings.bot;
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

    getEvalComments(ply, settingsHash) {
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
        let evaluationComment = `${
          evaluationAfter >= 0 ? "+" : ""
        }${evaluationAfter}`;

        if (positionBefore && settingsHash in positionBefore) {
          let position = positionBefore[settingsHash][0];
          if (position && position.ply) {
            let pv = [position.ply, ...position.followingPlies]
              .slice(0, 3)
              .map((ply) => ply.ptn);
            evaluationComment += `, pv ${pv.join(" ")}`;
          }
        }

        comments.push(evaluationComment);

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
        const settingsHash = this.botSettingsHash;
        let positions = plies.map((ply) => ply.tpsBefore);
        plies.forEach((ply) => {
          if (!ply.result || ply.result.type === "1") {
            positions.push(ply.tpsAfter);
          }
        });
        positions = uniq(positions).filter(
          (tps) =>
            !(tps in this.positions) || !(settingsHash in this.positions[tps])
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
      this.$set(this.positions, tps, {
        ...(this.positions[tps] || {}),
        [settingsHash]: result,
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
              this.tiltakWorker.isReady = true;
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
      if (!this.tiltakWorker.isReady) {
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
      const id = this.hashBotSettings({ bot: "tiltak" });
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
    tps() {
      if (this.tiltakInteractive.isEnabled) {
        this.requestTiltakInteractiveSuggestions();
      }
    },
    botPosition(position) {
      if (position) {
        if (this.botSettingsHash in position) {
          this.suggestions = position[this.botSettingsHash] || [];
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
    botSettingsHash(hash) {
      if (this.botPosition && hash in this.botPosition) {
        this.suggestions = this.botPosition[hash] || [];
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

        // Update current position/bot hash
        this.botSettingsHash = this.hashBotSettings(settings);

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
