<template>
  <recess class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <!-- Bot Suggestions -->
      <q-expansion-item
        v-if="showBotMovesPanel"
        v-model="sections.botSuggestions"
        header-class="bg-accent"
      >
        <template v-slot:header>
          <q-item-section avatar>
            <q-icon name="bot" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ $t("analysis.Bot Moves") }}</q-item-label>
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
        </smooth-reflow>

        <smooth-reflow>
          <q-btn
            v-if="!botMoves.length"
            @click="queryBotSuggestions(botThinkBudgetInSeconds.short)"
            :loading="loadingBotMoves"
            class="full-width"
            color="primary"
            stretch
          >
            {{ $t("analysis.Ask for suggestions") }}
          </q-btn>
          <!-- TODO when should we enable/show this button? -->
          <q-btn
            v-if="!botMoves.length || true"
            @click="queryBotSuggestionsForGame()"
            :loading="loadingBotMoves"
            class="full-width"
            color="primary"
            stretch
          >
            {{ $t("analysis.Analyse game") }}
          </q-btn>
        </smooth-reflow>

        <smooth-reflow>
          <AnalysisItem
            v-for="(move, i) in botMoves.slice(
              0,
              botSettings.maxSuggestedMoves
            )"
            :key="i"
            :ply="move.ply"
            :evaluation="move.evaluation"
            :following-plies="move.followingPlies"
            :count="move.visits"
            count-label="analysis.visits"
            :player1-number="
              move.evaluation >= 0 ? formatEvaluation(move.evaluation) : null
            "
            :player2-number="
              move.evaluation < 0 ? formatEvaluation(move.evaluation) : null
            "
          />
        </smooth-reflow>
        <smooth-reflow>
          <q-btn
            v-if="
              botMoves.length &&
              botMoves.every(
                ({ secondsToThink }) =>
                  secondsToThink < botThinkBudgetInSeconds.long
              )
            "
            @click="queryBotSuggestions(botThinkBudgetInSeconds.long)"
            :loading="loadingBotMoves"
            class="full-width"
            color="primary"
            stretch
          >
            {{ $t("analysis.Ask for better suggestions") }}
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
            <q-icon name="database" />
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
            :player-numbers-hint="winsHint(move)"
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
  </recess>
</template>

<script>
import AnalysisItem from "../database/AnalysisItem";
import DatabaseGame from "../database/DatabaseGame";
import DateInput from "../controls/DateInput";
import Ply from "../../Game/PTN/Ply";
import { deepFreeze, timestampToDate } from "../../utilities";
import { isArray, omit } from "lodash";
import Fuse from "fuse.js";

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
    game: Object,
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
      showBotMovesPanel: true,
      loadingBotMoves: false,
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
      botSettings: { ...this.$store.state.ui.botSettings },
      botThinkBudgetInSeconds: {
        short: 3,
        long: 8,
      },
      dbSettings: { ...this.$store.state.ui.dbSettings },
      botSettingsHash: this.hashSettings(this.$store.state.ui.botSettings),
      dbSettingsHash: this.hashSettings(this.$store.state.ui.dbSettings),
      sections: { ...this.$store.state.ui.analysisSections },
    };
  },
  computed: {
    isVisible() {
      return (
        this.$store.state.ui.showText &&
        this.$store.state.ui.textTab === "analysis"
      );
    },
    loadingDBs() {
      return this.databases && !this.databases.length;
    },
    theme() {
      return this.$store.state.ui.theme;
    },
    ply() {
      return this.$store.state.game.position.ply;
    },
    tps() {
      //  do not use this.$game.position.tps as it's not watchable
      return this.$store.state.game.position.tps;
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
    hashSettings(settings) {
      return Object.values(settings).join(",");
    },
    nextPly(player, color) {
      if (player === 2 && color === 1) {
        return { player: 1, color: 1 };
      }
      return { player: player === 1 ? 2 : 1, color: color === 1 ? 2 : 1 };
    },
    formatEvaluation(v) {
      return `${this.$n(Math.abs(v), "n2")}%`;
    },
    winsHint(move) {
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
    async queryBotSuggestionsForGame() {
      try {
        this.loadingBotMoves = true;
        const komi = this.game.config.komi;
        const size = this.game.config.size;
        const secondsToThinkPerPly = 1; // TODO change?

        // TODO there must be a better way to generate TPS with existing code
        const emptyTps = Array(6).fill(`x${size}`).join("/") + " 1 1";

        // TODO avoid checking positions we already have data for!
        // TODO iterate over all branches and variations

        const ptnMoves = this.game.ptn.branchPlies.map(({ text }) => text); // ["a6", "a1", ...]

        const moveCounts = [...Array(ptnMoves.length).keys()]; // [0, 1, 2... ptnMoves.length]
        // Use promises to allow concurrency while waiting for HTTP responses.
        // AWS Lambda allows limiting concurrent execution (minimum 10)
        const moveQueryPromises = moveCounts.map(async (moveCount) => {
          const moves = ptnMoves.slice(0, moveCount);
          // TODO nitzel: I think it would be better to not use `moves`
          // instead we should derive the full TPS from emptyTps+moves here
          // and use that in the request.
          const botMoves = await this.queryBotSuggestionsExt(
            secondsToThinkPerPly,
            emptyTps,
            komi,
            moves
          );
          console.log("bot moves for", moves, botMoves);
          return { baseTps: emptyTps, moves, botMoves };
          // TODO use result to populate this.botMoves as well as the PTN.vue component with the winning-probability graph
        });
        const moveResults = await Promise.all(moveQueryPromises);
        console.log("entire branch", moveResults);
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loadingBotMoves = false;
      }
    },
    async queryBotSuggestions(secondsToThink) {
      try {
        this.loadingBotMoves = true;

        const tps = this.tps;
        const komi = this.game.config.komi;
        const botMoves = deepFreeze(
          await this.queryBotSuggestionsExt(secondsToThink, tps, komi)
        );

        this.$set(this.botPositions, tps, {
          ...(this.botPositions[tps] || {}),
          [this.botSettingsHash]: botMoves,
        });
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loadingBotMoves = false;
      }
    },
    /** Queries `baseTps` position with `ptnMoves` applied to it.
     * @returns Explored moves and their winning probability (`evaluation`).
     * The suggested move with the highest `visits` should be played, ignoring `evaluation`.
     */
    async queryBotSuggestionsExt(secondsToThink, baseTps, komi, ptnMoves = []) {
      const response = await fetch(bestMoveEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          komi: komi,
          size: this.game.config.size,
          tps: baseTps,
          moves: ptnMoves, // moves played on top of the TPS
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

      return suggestedMoves.map(
        ({ mv: ptn, visits, winning_probability, pv }) => {
          let player = this.$store.state.game.position.turn;
          let color = this.$store.state.game.position.color;
          let ply = new Ply(ptn, { id: null, player, color });
          let followingPlies = pv.map((ply) => {
            ({ player, color } = this.nextPly(player, color));
            return new Ply(ply, { id: null, player, color });
          });
          let evaluation = 200 * (winning_probability - 0.5);
          return { ply, followingPlies, visits, evaluation, secondsToThink };
        }
      );
    },
    async loadUsernames() {
      const response = await fetch(usernamesEndpoint);
      const { white, black } = await response.json();
      this.player1Index = new Fuse(white);
      this.player2Index = new Fuse(black);
    },
    async loadDatabases() {
      try {
        const response = await fetch(databasesEndpoint);
        this.databases = await response.json();
      } catch (error) {
        this.databases = null;
        this.notifyError(error);
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
    async queryPosition() {
      const databaseId = this.databaseIdToQuery;
      if (databaseId === null) return;
      if (this.dbPosition && this.dbPosition[this.dbSettingsHash]) {
        return;
      }

      try {
        this.loadingDBMoves = true;

        const player = this.$store.state.game.position.turn;
        const color = this.$store.state.game.position.color;
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
    if (this.isVisible) {
      this.loadUsernames();
      await this.loadDatabases();
      // wait for databases to load before querying the position
      this.queryPosition();
    }
  },
  watch: {
    async isVisible(isVisible) {
      if (isVisible) {
        if (!this.databases || !this.databases.length) {
          await this.loadDatabases();
        }
        this.queryPosition();
        if (!this.player1Names.length) {
          this.loadUsernames();
        }
      }
    },
    tps() {
      if (this.isVisible) {
        this.queryPosition();
      }
    },
    botPosition(position) {
      if (position) {
        if (this.botSettingsHash in position) {
          this.botMoves = position[this.botSettingsHash] || [];
        }
      } else {
        this.botMoves = [];
      }
    },
    botSettingsHash(hash) {
      if (this.botPosition && hash in this.botPosition) {
        this.botMoves = this.botPosition[hash] || [];
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
        this.botSettingsHash = this.hashSettings(settings);
      },
      deep: true,
    },
    dbSettings: {
      handler(settings) {
        this.$store.dispatch("ui/SET_UI", ["dbSettings", settings]);
        this.dbSettingsHash = this.hashSettings(settings);
        this.queryPosition();
      },
      deep: true,
    },
  },
};
</script>
