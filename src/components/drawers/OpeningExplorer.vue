<template>
  <div>
    <!-- Database Moves -->
    <q-expansion-item
      v-if="dbMoves"
      v-model="sections.dbMoves"
      header-class="bg-accent"
      expand-icon-class="fg-inherit"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <img src="~assets/playtak.svg" width="24" height="24" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("analysis.Database Moves") }}</q-item-label>
          <q-item-label v-if="hasDBSettings" class="fg-inherit" caption>
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
        <q-item-section class="fg-inherit" side>
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
        <template v-else>
          <AnalysisItem
            v-for="(move, i) in dbMoves.slice(0, dbSettings.maxSuggestedMoves)"
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
        </template>
        <q-inner-loading :showing="loadingDBMoves || loadingDBs" />
      </smooth-reflow>
    </q-expansion-item>

    <!-- Database Games -->
    <q-expansion-item
      v-if="dbGames"
      v-model="sections.dbGames"
      :label="$t('analysis.Top Games from Position')"
      icon="top_games"
      header-class="bg-accent"
      expand-icon-class="fg-inherit"
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
        <template v-else>
          <DatabaseGame
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
        </template>
        <q-inner-loading :showing="loadingDBMoves || loadingDBs" />
      </smooth-reflow>
    </q-expansion-item>
  </div>
</template>

<script>
import AnalysisItem from "../analysis/AnalysisItem";
import DatabaseGame from "../analysis/DatabaseGame";
import DateInput from "../controls/DateInput";
import Ply from "../../Game/PTN/Ply";
import { deepFreeze, timestampToDate } from "../../utilities";
import { isArray, omit } from "lodash";
import Fuse from "fuse.js";
import hashObject from "object-hash";

import { OPENING_DB_API } from "../../constants";
const openingsEndpoint = `${OPENING_DB_API}/opening`;
const usernamesEndpoint = `${OPENING_DB_API}/players`;
const databasesEndpoint = `${OPENING_DB_API}/databases`;

export default {
  name: "OpeningExplorer",
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
      loadingDBMoves: false,
      showDBSettings: false,
      dbPositions: {},
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
      dbSettings: { ...this.$store.state.analysis.dbSettings },
      dbSettingsHash: this.hashDBSettings(
        this.$store.state.analysis.dbSettings
      ),
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
    allPlies() {
      return this.$store.state.game.ptn.allPlies;
    },
    loadingDBs() {
      return this.databases && !this.databases.length;
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
    toggleDBSettings() {
      this.showDBSettings = !this.showDBSettings;
      // Expand panel with settings if the panel was collapsed
      if (this.showDBSettings) {
        this.sections.dbMoves = true;
      }
    },
    hashDBSettings(settings) {
      return hashObject(omit(settings, "maxSuggestedMoves"));
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
      if (!this.isOffline) {
        // Load player names
        if (!this.player1Names.length) {
          this.loadUsernames();
        }

        // Load databases
        if (!this.databases.length) {
          try {
            const response = await fetch(databasesEndpoint);
            this.databases = await response.json();
          } catch (error) {
            this.databases = null;
            this.notifyError(error);
          }
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
        const max_suggested_moves = 20;
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
        if (!this.databases || !this.databases.length) {
          await this.init();
        }
        if (this.isDBMovesVisible) {
          this.queryDBPosition();
        }
      }
    },
    async isPanelVisible(isPanelVisible) {
      if (isPanelVisible) {
        if (!this.databases || !this.databases.length) {
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
    dbSettings: {
      handler(settings) {
        this.$store.dispatch("analysis/SET", ["dbSettings", settings]);
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
