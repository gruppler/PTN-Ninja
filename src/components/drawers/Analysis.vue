<template>
  <component :is="recess ? 'recess' : 'div'" class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <!-- Bot Suggestions -->
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
                max="99"
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
              stretch
            />
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
              stretch
            />
          </template>
        </smooth-reflow>

        <smooth-reflow>
          <AnalysisItem
            v-for="(move, i) in botMoves.slice(
              0,
              botSettings.maxSuggestedMoves
            )"
            :key="i"
            :ply="move.ply"
            :evaluation="'evaluation' in move ? move.evaluation : null"
            :following-plies="move.followingPlies"
            :count="
              'visits' in move
                ? move.visits
                : 'nodes' in move
                ? move.nodes
                : null
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

      <!-- Database Moves -->
      <q-expansion-item
        v-if="dbMoves"
        v-model="sections.dbMoves"
        header-class="bg-accent"
      >
        <template v-slot:header>
          <q-item-section avatar>
            <img src="~assets/playtak.svg" width="24" height="24" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $t("analysis.Database Moves") }}</q-item-label>
            <q-item-label v-if="hasDBSettings" caption>
              <div class="q-gutter-xs">
                <q-icon v-if="dbSettings.includeBotGames" name="bot">
                  <tooltip>{{ $t("analysis.includeBotGames") }}</tooltip>
                </q-icon>
                <q-icon
                  v-if="dbSettings.player1 && dbSettings.player1.length"
                  name="player1"
                >
                  <tooltip>{{ dbSettings.player1.join(", ") }}</tooltip>
                </q-icon>
                <q-icon
                  v-if="dbSettings.player2 && dbSettings.player2.length"
                  name="player2"
                >
                  <tooltip>{{ dbSettings.player2.join(", ") }}</tooltip>
                </q-icon>
                <q-icon
                  v-if="Number.isFinite(dbSettings.minRating)"
                  name="rating1"
                >
                  <tooltip>{{ dbSettings.minRating }}</tooltip>
                </q-icon>
                <q-icon
                  v-if="dbSettings.komi && dbSettings.komi.length"
                  name="komi"
                >
                  <tooltip>
                    {{ $t("Komi") }}
                    {{ dbSettings.komi.join(", ").replace(/0?\.5/g, "½") }}
                  </tooltip>
                </q-icon>
                <q-icon
                  v-if="dbSettings.tournament !== null"
                  :name="dbSettings.tournament ? 'event' : 'event_outline'"
                >
                  <tooltip>{{
                    $t(
                      "analysis.tournamentOptions." +
                        (dbSettings.tournament ? "only" : "exclude")
                    )
                  }}</tooltip>
                </q-icon>
                <q-icon v-if="dbSettings.minDate" name="date_arrow_right">
                  <tooltip>
                    {{ $t("analysis.minDate") }}
                    <relative-date
                      :value="new Date(dbSettings.minDate)"
                      text-only
                    />
                  </tooltip>
                </q-icon>
                <q-icon v-if="dbSettings.maxDate" name="date_arrow_left">
                  <tooltip>
                    {{ $t("analysis.maxDate") }}
                    <relative-date
                      :value="new Date(dbSettings.maxDate)"
                      text-only
                    />
                  </tooltip>
                </q-icon>
              </div>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              @click.stop="toggleDBSettings"
              icon="settings"
              :color="showDBSettings ? 'primary' : ''"
              dense
              round
              flat
            />
          </q-item-section>
        </template>

        <smooth-reflow class="bg-ui" height-only>
          <template v-if="showDBSettings">
            <!-- Include Bots -->
            <q-item tag="label" clickable v-ripple>
              <q-item-section avatar>
                <q-icon
                  :name="dbSettings.includeBotGames ? 'bot_on' : 'bot_off'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ $t("analysis.includeBotGames") }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle v-model="dbSettings.includeBotGames" />
              </q-item-section>
            </q-item>

            <!-- Player 1 -->
            <q-select
              v-model="dbSettings.player1"
              :options="player1Names"
              :loading="!player1Index"
              :label="$t('Player1')"
              behavior="menu"
              transition-show="none"
              transition-hide="none"
              item-aligned
              clearable
              filled
              multiple
              use-input
              @filter="searchPlayer1"
              hide-dropdown-icon
            >
              <template v-slot:prepend>
                <q-icon name="player1" />
              </template>
            </q-select>

            <!-- Player 2 -->
            <q-select
              v-model="dbSettings.player2"
              :options="player2Names"
              :loading="!player2Index"
              :label="$t('Player2')"
              behavior="menu"
              transition-show="none"
              transition-hide="none"
              item-aligned
              clearable
              filled
              multiple
              use-input
              @filter="searchPlayer2"
              hide-dropdown-icon
            >
              <template v-slot:prepend>
                <q-icon name="player2" />
              </template>
            </q-select>

            <!-- Minimum Rating -->
            <q-input
              v-model.number="dbSettings.minRating"
              :label="$t('Minimum Rating')"
              type="number"
              :min="dbMinRating"
              max="5000"
              step="10"
              :placeholder="dbMinRating"
              item-aligned
              clearable
              filled
            >
              <template v-slot:prepend>
                <q-icon name="rating1" />
              </template>
            </q-input>

            <!-- Komi -->
            <q-select
              v-model="dbSettings.komi"
              :options="komiOptions"
              :label="$t('Komi')"
              type="number"
              emit-value
              map-options
              behavior="menu"
              transition-show="none"
              transition-hide="none"
              item-aligned
              clearable
              filled
              multiple
            >
              <template v-slot:prepend>
                <q-icon name="komi" />
              </template>
            </q-select>

            <!-- Game type -->
            <q-select
              v-model="dbSettings.tournament"
              :options="tournamentOptions"
              :label="$t('analysis.gameType')"
              emit-value
              map-options
              behavior="menu"
              transition-show="none"
              transition-hide="none"
              item-aligned
              clearable
              filled
            >
              <template v-slot:prepend>
                <q-icon
                  :name="dbSettings.tournament ? 'event' : 'event_outline'"
                />
              </template>
            </q-select>

            <!-- Min/Max Dates -->
            <DateInput
              :label="$t('analysis.minDate')"
              v-model="dbSettings.minDate"
              :max="dbSettings.maxDate ? new Date(dbSettings.maxDate) : null"
              icon="date_arrow_right"
              item-aligned
              clearable
              filled
            />
            <DateInput
              :label="$t('analysis.maxDate')"
              v-model="dbSettings.maxDate"
              :min="dbSettings.minDate ? new Date(dbSettings.minDate) : null"
              icon="date_arrow_left"
              item-aligned
              clearable
              filled
            />

            <!-- Max Suggestions -->
            <q-input
              v-model.number="dbSettings.maxSuggestedMoves"
              :label="$t('analysis.maxSuggestedMoves')"
              type="number"
              min="1"
              max="99"
              step="1"
              item-aligned
              filled
            >
              <template v-slot:prepend>
                <q-icon name="moves" />
              </template>
            </q-input>
          </template>
        </smooth-reflow>

        <smooth-reflow class="relative-position">
          <q-item v-if="!databases" class="flex-center bg-negative" dark>
            {{ $t("analysis.database.error") }}
          </q-item>
          <q-item v-else-if="!databases.length" class="flex-center">
            {{ $t("analysis.database.loading") }}
          </q-item>
          <q-item v-else-if="noMatchingDatabase" class="flex-center">
            {{ $t("analysis.database.notFound") }}
          </q-item>
          <q-item v-else-if="!dbMoves.length" class="flex-center">
            {{ loadingDBMoves ? "" : $t("analysis.database.newPosition") }}
          </q-item>
          <AnalysisItem
            v-else
            v-for="(move, i) in dbMoves"
            :key="i"
            :ply="move.ply"
            :evaluation="move.evaluation"
            :count="move.totalGames"
            count-label="analysis.n_games"
            :player1-number="$n(move.wins1, 'n0')"
            :middle-number="move.draws ? $n(move.draws, 'n0') : null"
            :player2-number="$n(move.wins2, 'n0')"
            :player-numbers-tooltip="winsTooltip(move)"
          />
          <q-inner-loading :showing="loadingDBMoves || loadingDBs" />
        </smooth-reflow>
      </q-expansion-item>

      <!-- Database Games -->
      <q-expansion-item
        v-if="dbGames"
        v-model="sections.dbGames"
        :label="$t('analysis.Top Games from Position')"
        icon="board"
        header-class="bg-accent"
      >
        <smooth-reflow>
          <q-item v-if="!databases" class="flex-center bg-negative" dark>
            {{ $t("analysis.database.error") }}
          </q-item>
          <q-item v-else-if="!databases.length" class="flex-center">
            {{ $t("analysis.database.loading") }}
          </q-item>
          <q-item v-else-if="noMatchingDatabase" class="flex-center">
            {{ $t("analysis.database.notFound") }}
          </q-item>
          <q-item v-else-if="!dbGames.length" class="flex-center">
            {{ loadingDBMoves ? "" : $t("analysis.database.newPosition") }}
          </q-item>
          <DatabaseGame
            v-else
            v-for="(game, i) in dbGames"
            :key="i"
            :playtak-id="game.playtakId"
            :player1="game.player1"
            :player2="game.player2"
            :rating1="game.rating1"
            :rating2="game.rating2"
            :result="game.result"
            :date="game.date"
            :komi="game.komi"
            :tournament="game.tournament"
          />
          <q-inner-loading :showing="loadingDBMoves || loadingDBs" />
        </smooth-reflow>
      </q-expansion-item>
    </q-scroll-area>
  </component>
</template>

<script>
import AnalysisItem from "../database/AnalysisItem";
import DatabaseGame from "../database/DatabaseGame";
import DateInput from "../controls/DateInput";
import Ply from "../../Game/PTN/Ply";
import { deepFreeze, timestampToDate } from "../../utilities";
import { isArray, omit, pick, uniq } from "lodash";
import Fuse from "fuse.js";
import asyncPool from "tiny-async-pool";

const apiUrl = "https://openings.exegames.de/api/v1";
// const apiUrl = `http://127.0.0.1:5000/api/v1`;
const openingsEndpoint = `${apiUrl}/opening`;
const usernamesEndpoint = `${apiUrl}/players`;
const databasesEndpoint = `${apiUrl}/databases`;
const bestMoveEndpoint =
  "https://tdp04uo1d9.execute-api.eu-north-1.amazonaws.com/tiltak";

export default {
  name: "Analysis",
  components: { AnalysisItem, DatabaseGame, DateInput },
  props: {
    recess: Boolean,
  },
  data() {
    let komiOptions = [];
    for (let value = 0; value <= 4; value += 0.5) {
      komiOptions.push({
        label: value.toString().replace(/0?\.5/, "½"),
        value,
      });
    }

    return {
      loadingTiltakMoves: false,
      loadingTiltakAnalysis: false,
      progressTiltakAnalysis: 0,
      loadingTopazMoves: false,
      progressTopazAnalysis: 0,
      topazTimer: null,
      loadingDBMoves: false,
      showBotSettings: false,
      showDBSettings: false,
      botPositions: {},
      dbPositions: {},
      botMoves: [],
      dbMoves: [],
      dbGames: [],
      /**
       * List of available databases that can be queried by their index
       * @type { {include_bot_games: bool, min_rating: number, size: number}[]? }
       */
      databases: [],
      player1Index: null,
      player1Names: [],
      player2Index: null,
      player2Names: [],
      komiOptions,
      tournamentOptions: [
        { label: this.$t("analysis.tournamentOptions.exclude"), value: false },
        { label: this.$t("analysis.tournamentOptions.only"), value: true },
      ],
      dbMinRating: 0,
      bots: ["tiltak", "topaz"].map((value) => ({
        value,
        label: this.$t(`analysis.bots.${value}`),
      })),
      botSettings: { ...this.$store.state.ui.botSettings },
      botThinkBudgetInSeconds: {
        short: 3,
        long: 8,
      },
      dbSettings: { ...this.$store.state.ui.dbSettings },
      botSettingsHash: this.hashBotSettings(this.$store.state.ui.botSettings),
      dbSettingsHash: this.hashDBSettings(this.$store.state.ui.dbSettings),
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
    isDBMovesVisible() {
      return (
        this.isPanelVisible && (this.sections.dbMoves || this.sections.dbGames)
      );
    },
    showAllBranches() {
      return this.$store.state.ui.showAllBranches;
    },
    plies() {
      return this.$store.state.game.ptn[
        [this.showAllBranches ? "allPlies" : "branchPlies"]
      ];
    },
    isFullyAnalyzed() {
      return this.plies.every(
        (ply) =>
          this.plyHasEvalComment(ply) || (ply.result && ply.result.type !== "1")
      );
    },
    loadingDBs() {
      return this.databases && !this.databases.length;
    },
    theme() {
      return this.$store.state.ui.theme;
    },
    game() {
      return this.$store.state.game;
    },
    ply() {
      return this.$store.state.game.position.ply;
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
    dbPosition() {
      return this.dbPositions[this.tps] || null;
    },
    hasDBSettings() {
      return Object.values(omit(this.dbSettings, "maxSuggestedMoves")).some(
        (setting) => setting !== null && (!isArray(setting) || setting.length)
      );
    },
    /**
     * Select the ID of the database to use for the current board size and search filters
     * @returns The ID of the best matching DB, `null` if there isn't any.
     * board-size and include-bot-games are hard filters, min-rating is soft.
     */
    databaseIdToQuery() {
      if (!this.databases || !this.databases.length) {
        return null;
      }

      const dbsOfCorrectSize = this.databases.filter(
        ({ size }) => size == this.game.config.size
      );
      const dbsMatchingBotFilter = dbsOfCorrectSize.filter(
        ({ include_bot_games }) =>
          include_bot_games || !this.dbSettings.includeBotGames
      );

      if (!dbsMatchingBotFilter.length) {
        return null;
      }
      const bestMatchingDb = dbsMatchingBotFilter.reduce(
        (a, b) => (a.min_rating < b.min_rating ? a : b),
        dbsMatchingBotFilter[0]
      );

      return this.databases.indexOf(bestMatchingDb);
    },
    noMatchingDatabase() {
      return this.databaseIdToQuery === null;
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
    toggleDBSettings() {
      this.showDBSettings = !this.showDBSettings;
      // Expand panel with settings if the panel was collapsed
      if (this.showDBSettings) {
        this.sections.dbMoves = true;
      }
    },
    hashBotSettings(settings) {
      if (settings.bot === "tiltak") {
        return Object.values(pick(settings, ["bot", "maxSuggestedMoves"])).join(
          ","
        );
      } else {
        return Object.values(
          pick(settings, ["bot", "depth", "timeBudget"])
        ).join(",");
      }
    },
    hashDBSettings(settings) {
      return Object.values(settings).join(",");
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

    winsTooltip(move) {
      const gameCount = move.totalGames;
      const percentageString = (count) => this.$n(count / gameCount, "percent");

      return `${this.$t("Player1")} – ${this.$n(move.wins1)} ${this.$tc(
        "analysis.wins",
        move.wins1
      )} – ${percentageString(move.wins1)}\n${this.$t("Player2")} – ${this.$n(
        move.wins2
      )} ${this.$tc("analysis.wins", move.wins2)} – ${percentageString(
        move.wins2
      )}\n${this.$n(move.draws)} ${this.$tc(
        "analysis.draws",
        move.draws
      )} – ${percentageString(move.draws)}`;
    },

    plyHasEvalComment(ply) {
      return (
        ply.id in this.game.comments.notes &&
        this.game.comments.notes[ply.id].some((comment) => comment.evaluation)
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
          : 100 * (ply.result.winner * 2 - 1);
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

    /** Queries `tps` position.
     * @returns Explored moves and their winning probability (`evaluation`).
     * The suggested move with the highest `visits` should be played, ignoring `evaluation`.
     */
    async loadUsernames() {
      if (this.isOffline) {
        return;
      }
      const response = await fetch(usernamesEndpoint);
      const { white, black } = await response.json();
      this.player1Index = new Fuse(white);
      this.player2Index = new Fuse(black);
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

      if (!this.isOffline) {
        // Load player names
        if (!this.player1Names.length) {
          this.loadUsernames();
        }

        // Load databases
        try {
          const response = await fetch(databasesEndpoint);
          this.databases = await response.json();
        } catch (error) {
          this.databases = null;
          this.notifyError(error);
        }
      }
    },

    searchPlayer1(query, update) {
      update(
        () =>
          (this.player1Names = this.player1Index
            .search(query)
            .map((result) => result.item)),
        (ref) => {
          if (query.trim() !== "" && ref.options.length > 0) {
            ref.setOptionIndex(-1);
            ref.moveOptionSelection(1, true);
          }
        }
      );
    },
    searchPlayer2(query, update) {
      update(
        () =>
          (this.player2Names = this.player2Index
            .search(query)
            .map((result) => result.item)),
        (ref) => {
          if (query.trim() !== "" && ref.options.length > 0) {
            ref.setOptionIndex(-1);
            ref.moveOptionSelection(1, true);
          }
        }
      );
    },

    async queryDBPosition() {
      if (this.isOffline) {
        return;
      }
      const databaseId = this.databaseIdToQuery;
      if (databaseId === null) return;
      if (this.dbPosition && this.dbPosition[this.dbSettingsHash]) {
        return;
      }

      try {
        this.loadingDBMoves = true;

        const player = this.game.position.turn;
        const color = this.game.position.color;
        const tps = this.tps;
        const uriEncodedTps = encodeURIComponent(tps);

        // DB Settings
        const min_rating =
          this.dbSettings.minRating === null
            ? 0
            : parseInt(this.dbSettings.minRating);
        const komi =
          this.dbSettings.komi === null
            ? null
            : parseFloat(this.dbSettings.komi);
        const max_suggested_moves = parseInt(
          this.dbSettings.maxSuggestedMoves || 20
        );
        const settings = {
          include_bot_games: this.dbSettings.includeBotGames,
          tournament: this.dbSettings.tournament,
          white: this.dbSettings.player1 || null,
          black: this.dbSettings.player2 || null,
          min_date: this.dbSettings.minDate,
          max_date: this.dbSettings.maxDate,
          min_rating,
          komi,
          max_suggested_moves,
        };

        const response = await fetch(
          `${openingsEndpoint}/${databaseId}/${uriEncodedTps}`,
          {
            method: "POST",
            mode: "cors",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(settings),
          }
        );
        if (!response.ok) {
          return this.notifyError("HTTP-Error: " + response.status);
        }
        const data = await response.json();

        const dbMoves = deepFreeze(
          data.moves.map((move, id) => {
            let ply = new Ply(move.ptn, { id: null, player, color });
            let wins1 = move.white;
            let wins2 = move.black;
            let draws = move.draw;
            let totalGames = wins1 + wins2 + draws;
            let evaluation = 200 * (wins1 / (wins1 + wins2) - 0.5);
            return { id, ply, evaluation, totalGames, wins1, wins2, draws };
          })
        );

        const dbGames = deepFreeze(
          (data.games || []).map((game) => ({
            playtakId: game.playtak_id,
            player1: game.white.name,
            player2: game.black.name,
            rating1: game.white.rating,
            rating2: game.black.rating,
            result: game.result,
            date: timestampToDate(game.date),
            komi: game.komi,
            tournament: game.tournament,
          }))
        );

        this.$set(this.dbPositions, tps, {
          ...(this.dbPositions[tps] || {}),
          [this.dbSettingsHash]: { dbMoves, dbGames, settings: data.settings },
        });
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loadingDBMoves = false;
      }
    },
  },

  async mounted() {
    await this.init();
    // wait for databases to load before querying the position
    if (this.isPanelVisible && !this.isOffline) {
      this.queryDBPosition();
    }
  },

  watch: {
    async isOffline(isOffline) {
      if (!isOffline && this.isPanelVisible) {
        if (!this.topazWorker || !this.databases || !this.databases.length) {
          await this.init();
        }
        if (this.isDBMovesVisible) {
          this.queryDBPosition();
        }
      }
    },
    async isPanelVisible(isPanelVisible) {
      if (isPanelVisible) {
        if (!this.topazWorker || !this.databases || !this.databases.length) {
          await this.init();
        }
        if (this.isDBMovesVisible && !this.isOffline) {
          this.queryDBPosition();
        }
      }
    },
    isDBMovesVisible(isVisible) {
      if (isVisible && !this.isOffline) {
        this.queryDBPosition();
      }
    },
    tps() {
      if (this.isDBMovesVisible && !this.isOffline) {
        this.queryDBPosition();
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
    dbPosition(position) {
      if (position && this.dbSettingsHash in position) {
        this.dbMoves = position[this.dbSettingsHash].dbMoves || [];
        this.dbGames = position[this.dbSettingsHash].dbGames || [];
        this.dbMinRating =
          position[this.dbSettingsHash].settings.min_rating || 0;
      }
    },
    dbSettingsHash(hash) {
      if (this.dbPosition && hash in this.dbPosition) {
        this.dbMoves = this.dbPosition[hash].dbMoves || [];
        this.dbGames = this.dbPosition[hash].dbGames || [];
        this.dbMinRating = this.dbPosition[hash].settings.min_rating || 0;
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
    dbSettings: {
      handler(settings) {
        this.$store.dispatch("ui/SET_UI", ["dbSettings", settings]);
        this.dbSettingsHash = this.hashDBSettings(settings);
        if (!this.isOffline) {
          this.queryDBPosition();
        }
      },
      deep: true,
    },
  },
};
</script>
