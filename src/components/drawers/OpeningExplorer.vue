<template>
  <div>
    <!-- Database Moves -->
    <q-expansion-item
      v-if="dbMoves"
      v-model="dbMovesExpanded"
      header-class="bg-accent"
      expand-icon-class="fg-inherit"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <img src="~assets/playtak.svg" width="24" height="24" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ $t("analysis.Database Moves") }}</q-item-label>
          <q-item-label class="fg-inherit" caption>
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

      <recess>
        <smooth-reflow height-only>
          <template v-if="showDBSettings">
            <!-- Include Bots -->
            <q-item
              tag="label"
              :class="[
                $store.state.ui.theme.panelDark
                  ? 'text-textLight'
                  : 'text-textDark',
              ]"
              clickable
              v-ripple
            >
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
                <q-toggle
                  v-model="dbSettings.includeBotGames"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- Player 1 -->
            <q-select
              ref="player1"
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
              @input="$refs.player1.updateInputValue('')"
              :dark="$store.state.ui.theme.panelDark"
              hide-dropdown-icon
            >
              <template v-slot:prepend>
                <q-icon name="player1" />
              </template>
            </q-select>

            <!-- Player 2 -->
            <q-select
              ref="player2"
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
              @input="$refs.player2.updateInputValue('')"
              :dark="$store.state.ui.theme.panelDark"
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
              :dark="$store.state.ui.theme.panelDark"
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
              :dark="$store.state.ui.theme.panelDark"
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
              :dark="$store.state.ui.theme.panelDark"
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
              :dark="$store.state.ui.theme.panelDark"
            />
            <DateInput
              :label="$t('analysis.maxDate')"
              v-model="dbSettings.maxDate"
              :min="dbSettings.minDate ? new Date(dbSettings.minDate) : null"
              icon="date_arrow_left"
              item-aligned
              clearable
              filled
              :dark="$store.state.ui.theme.panelDark"
            />

            <!-- Max Suggestions -->
            <q-input
              v-model.number="dbSettings.maxSuggestedMoves"
              :label="$t('analysis.maxSuggestedMoves')"
              type="number"
              min="1"
              max="20"
              step="1"
              item-aligned
              filled
              :dark="$store.state.ui.theme.panelDark"
            >
              <template v-slot:prepend>
                <q-icon name="moves" />
              </template>
            </q-input>

            <q-separator :dark="$store.state.ui.theme.panelDark" />
          </template>
        </smooth-reflow>
      </recess>

      <recess>
        <smooth-reflow class="relative-position">
          <!-- Messages with placeholders behind them -->
          <template
            v-if="
              !databases ||
              !databases.length ||
              noMatchingDatabase ||
              isBeyondOpeningDB ||
              !dbMoves.length
            "
          >
            <AnalysisItemPlaceholder
              v-for="i in dbSettings.maxSuggestedMoves"
              :key="'placeholder-' + i"
              :show-continuation="false"
              static
            />
            <q-item
              v-if="!databases"
              class="flex-center text-center text-grey-1 bg-negative absolute-center full-width"
              dark
            >
              {{ $t("analysis.database.error") }}
            </q-item>
            <q-item
              v-else-if="!databases.length"
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ $t("analysis.database.loading") }}
            </q-item>
            <q-item
              v-else-if="noMatchingDatabase"
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ $t("analysis.database.notFound") }}
            </q-item>
            <q-item
              v-else-if="isBeyondOpeningDB"
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ $t("analysis.database.beyondRange") }}
            </q-item>
            <q-item
              v-else
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ loadingDBMoves ? "" : $t("analysis.database.newPosition") }}
            </q-item>
          </template>
          <!-- Actual results with filler placeholders -->
          <template v-else>
            <AnalysisItem
              v-for="(move, i) in dbMoves.slice(
                0,
                dbSettings.maxSuggestedMoves
              )"
              :key="i"
              :ply="move.ply"
              :evaluation="move.evaluation"
              :count="move.totalGames"
              count-label="analysis.n_games"
              :player1-number="$n(move.wins1, 'n0')"
              :middle-number="move.draws ? $n(move.draws, 'n0') : null"
              :player2-number="$n(move.wins2, 'n0')"
              :player-numbers-tooltip="winsTooltip(move)"
              :done-count="isMovePlayed(move) ? 1 : 0"
            />
            <AnalysisItemPlaceholder
              v-for="i in dbMovesFillerCount"
              :key="'filler-' + i"
              :show-continuation="false"
              static
            />
          </template>
          <q-inner-loading
            :showing="loadingDBMoves || loadingDBs"
            :dark="$store.state.ui.theme.panelDark"
            :color="textColor"
          />
        </smooth-reflow>
      </recess>
    </q-expansion-item>

    <!-- Database Games -->
    <q-expansion-item
      v-if="dbGames"
      v-model="dbGamesExpanded"
      header-class="bg-accent"
      expand-icon-class="fg-inherit"
    >
      <template v-slot:header>
        <q-item-section avatar>
          <q-icon name="top_games" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            {{ $t("analysis.Top Games from Position") }}
          </q-item-label>
          <q-item-label class="fg-inherit" caption>
            <div class="q-gutter-xs">
              <q-icon v-if="dbSettings.openGamesInNewTab" name="open_in_new">
                <tooltip>{{ $t("analysis.openGamesInNewTab") }}</tooltip>
              </q-icon>
            </div>
          </q-item-label>
        </q-item-section>
        <q-item-section class="fg-inherit" side>
          <q-btn
            @click.stop="toggleTopGamesSettings"
            icon="settings"
            :color="showTopGamesSettings ? 'primary' : ''"
            dense
            round
            flat
          />
        </q-item-section>
      </template>

      <recess>
        <smooth-reflow height-only>
          <template v-if="showTopGamesSettings">
            <!-- Open in New Tab -->
            <q-item
              tag="label"
              :class="[
                $store.state.ui.theme.panelDark
                  ? 'text-textLight'
                  : 'text-textDark',
              ]"
              clickable
              v-ripple
            >
              <q-item-section avatar>
                <q-icon name="open_in_new" />
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ $t("analysis.openGamesInNewTab") }}
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-toggle
                  v-model="dbSettings.openGamesInNewTab"
                  :dark="$store.state.ui.theme.panelDark"
                />
              </q-item-section>
            </q-item>

            <!-- Max Top Games -->
            <q-input
              v-model.number="dbSettings.maxTopGames"
              :label="$t('analysis.maxTopGames')"
              type="number"
              min="1"
              max="10"
              step="1"
              item-aligned
              filled
              :dark="$store.state.ui.theme.panelDark"
            >
              <template v-slot:prepend>
                <q-icon name="top_games" />
              </template>
            </q-input>
            <q-separator :dark="$store.state.ui.theme.panelDark" />
          </template>
        </smooth-reflow>
      </recess>

      <recess>
        <smooth-reflow class="relative-position">
          <!-- Messages with placeholders behind them -->
          <template
            v-if="
              !databases ||
              !databases.length ||
              noMatchingDatabase ||
              isBeyondOpeningDB ||
              !dbGames.length
            "
          >
            <DatabaseGamePlaceholder
              v-for="i in maxTopGames"
              :key="'placeholder-' + i"
              static
            />
            <q-item
              v-if="!databases"
              class="flex-center text-center text-grey-1 bg-negative absolute-center full-width"
              dark
            >
              {{ $t("analysis.database.error") }}
            </q-item>
            <q-item
              v-else-if="!databases.length"
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ $t("analysis.database.loading") }}
            </q-item>
            <q-item
              v-else-if="noMatchingDatabase"
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ $t("analysis.database.notFound") }}
            </q-item>
            <q-item
              v-else-if="isBeyondOpeningDB"
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ $t("analysis.database.beyondRange") }}
            </q-item>
            <q-item
              v-else
              class="flex-center text-center absolute-center full-width"
              :class="textClass"
            >
              {{ loadingDBMoves ? "" : $t("analysis.database.newPosition") }}
            </q-item>
          </template>
          <!-- Actual results with filler placeholders -->
          <template v-else>
            <DatabaseGame
              v-for="(game, i) in dbGames.slice(0, maxTopGames)"
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
              :dark="$store.state.ui.theme.panelDark"
              :next-move="game.nextMove"
            />
            <DatabaseGamePlaceholder
              v-for="i in dbGamesFillerCount"
              :key="'filler-' + i"
              static
            />
          </template>
          <q-inner-loading
            :showing="loadingDBMoves || loadingDBs"
            :dark="$store.state.ui.theme.panelDark"
            :color="textColor"
          />
        </smooth-reflow>
      </recess>
    </q-expansion-item>
  </div>
</template>

<script>
import AnalysisItem from "../analysis/AnalysisItem";
import AnalysisItemPlaceholder from "../analysis/AnalysisItemPlaceholder";
import DatabaseGame from "../analysis/DatabaseGame";
import DatabaseGamePlaceholder from "../analysis/DatabaseGamePlaceholder";
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
  components: {
    AnalysisItem,
    AnalysisItemPlaceholder,
    DatabaseGame,
    DatabaseGamePlaceholder,
    DateInput,
  },
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
      showTopGamesSettings: false,
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
      dbMovesExpanded: this.$store.state.ui.analysisSections.dbMoves,
      dbGamesExpanded: this.$store.state.ui.analysisSections.dbGames,
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
        this.isPanelVisible && (this.dbMovesExpanded || this.dbGamesExpanded)
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
    plyIndex() {
      return this.$store.state.game.position.plyIndex;
    },
    isBeyondOpeningDB() {
      const config = this.$store.state.game.config;
      const tpsOffset =
        (config.firstMoveNumber - 1) * 2 + (config.firstPlayer - 1);
      return tpsOffset + this.plyIndex >= 9;
    },
    textColor() {
      return this.$store.state.ui.theme.panelDark ? "textLight" : "textDark";
    },
    textClass() {
      return "text-" + this.textColor;
    },
    maxTopGames() {
      return this.dbSettings.maxTopGames || 4;
    },
    dbMovesFillerCount() {
      const shown = Math.min(
        this.dbMoves.length,
        this.dbSettings.maxSuggestedMoves
      );
      return Math.max(0, this.dbSettings.maxSuggestedMoves - shown);
    },
    dbGamesFillerCount() {
      const shown = Math.min(this.dbGames.length, this.maxTopGames);
      return Math.max(0, this.maxTopGames - shown);
    },
  },
  methods: {
    toggleDBSettings() {
      this.showDBSettings = !this.showDBSettings;
      // Expand panel with settings if the panel was collapsed
      if (this.showDBSettings) {
        this.dbMovesExpanded = true;
      }
    },
    toggleTopGamesSettings() {
      this.showTopGamesSettings = !this.showTopGamesSettings;
      // Expand panel with settings if the panel was collapsed
      if (this.showTopGamesSettings) {
        this.dbGamesExpanded = true;
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

    isMovePlayed(move) {
      // Check if this move was actually played in the current game
      const position = this.$store.state.game.position;
      if (!position || !position.boardPly) {
        return false;
      }

      // Get the next ply in the current game
      const nextPlyIndex = position.plyIndex + 1;
      const nextPly = this.allPlies.find((ply) => ply.index === nextPlyIndex);

      if (!nextPly) {
        return false;
      }

      // Compare the move text to see if they match
      return move.ply.text === nextPly.text;
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
      if (this.isBeyondOpeningDB) {
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
            nextMove: game.next_move,
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
    dbMovesExpanded(value) {
      const sections = { ...this.$store.state.ui.analysisSections };
      if (sections.dbMoves !== value) {
        sections.dbMoves = value;
        this.$store.dispatch("ui/SET_UI", ["analysisSections", sections]);
      }
    },
    dbGamesExpanded(value) {
      const sections = { ...this.$store.state.ui.analysisSections };
      if (sections.dbGames !== value) {
        sections.dbGames = value;
        this.$store.dispatch("ui/SET_UI", ["analysisSections", sections]);
      }
    },
    "$store.state.ui.analysisSections.dbMoves"(value) {
      if (this.dbMovesExpanded !== value) {
        this.dbMovesExpanded = value;
      }
    },
    "$store.state.ui.analysisSections.dbGames"(value) {
      if (this.dbGamesExpanded !== value) {
        this.dbGamesExpanded = value;
      }
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
