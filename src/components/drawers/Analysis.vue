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
              @click.stop="showBotSettings = !showBotSettings"
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
            v-if="
              !botMoves.length ||
              (showBotSettings &&
                botSettings.maxSuggestedMoves > botMoves.length)
            "
            @click="queryBotSuggestions"
            :loading="loadingBotMoves"
            class="full-width"
            color="primary"
            stretch
          >
            {{ $t("analysis.Ask for suggestions") }}
          </q-btn>
        </smooth-reflow>

        <smooth-reflow>
          <AnalysisItem
            v-for="(move, i) in botMoves"
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
                <q-icon v-if="dbSettings.includeBotGames" name="bot" />
                <q-icon
                  v-if="dbSettings.player1 && dbSettings.player1.length"
                  name="player1"
                />
                <q-icon
                  v-if="dbSettings.player2 && dbSettings.player2.length"
                  name="player2"
                />
                <q-icon
                  v-if="Number.isFinite(dbSettings.minRating)"
                  name="rating1"
                />
                <q-icon
                  v-if="dbSettings.komi && dbSettings.komi.length"
                  name="komi"
                />
              </div>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              @click.stop="showDBSettings = !showDBSettings"
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
              min="-4.5"
              max="4.5"
              step="0.5"
              item-aligned
              clearable
              filled
              multiple
            >
              <template v-slot:prepend>
                <q-icon name="komi" />
              </template>
            </q-select>

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
          <q-item v-if="!dbGames.length" class="flex-center">
            {{ $t("None") }}
          </q-item>
          <AnalysisItem
            v-else
            v-for="(move, i) in dbMoves"
            :key="i"
            :ply="move.ply"
            :evaluation="move.evaluation"
            :count="move.totalGames"
            count-label="analysis.games"
            :player1-number="$n(move.wins1, 'n0')"
            :player2-number="$n(move.wins2, 'n0')"
            :player-numbers-hint="winsHint(move)"
          />
          <q-inner-loading :showing="loadingDBMoves" />
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
          <q-item v-if="!dbGames.length" class="flex-center">
            {{ $t("None") }}
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
          <q-inner-loading :showing="loadingDBMoves" />
        </smooth-reflow>
      </q-expansion-item>
    </q-scroll-area>
  </recess>
</template>

<script>
import AnalysisItem from "../database/AnalysisItem";
import DatabaseGame from "../database/DatabaseGame";
import Ply from "../../Game/PTN/Ply";
import { deepFreeze, timestampToDate } from "../../utilities";
import { omit } from "lodash";
import Fuse from "fuse.js";

const apiUrl = "https://openings.exegames.de/api/v1";
// const apiUrl = `http://127.0.0.1:5000/api/v1`;
const bestMoveEndpoint = `${apiUrl}/best_move`;
const openingsEndpoint = `${apiUrl}/opening`;
const usernamesEndpoint = `${apiUrl}/players`;

export default {
  name: "Analysis",
  components: { AnalysisItem, DatabaseGame },
  props: {
    game: Object,
    recess: Boolean,
  },
  data() {
    return {
      showBotMovesPanel: false, //"show_bot_moves_panel" in this.$route.query,
      loadingBotMoves: false,
      loadingDBMoves: false,
      showBotSettings: false,
      showDBSettings: false,
      botPositions: {},
      dbPositions: {},
      botMoves: [],
      dbMoves: [],
      dbGames: [],
      player1Index: null,
      player1Names: [],
      player2Index: null,
      player2Names: [],
      komiOptions: ["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4"],
      dbMinRating: 0,
      botSettings: { ...this.$store.state.ui.botSettings },
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
        Boolean
      );
    },
  },
  methods: {
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
      return `${this.$t("Player1")} – ${this.$n(move.wins1)} ${this.$tc(
        "wins",
        move.wins1
      )}\n${this.$t("Player2")} – ${this.$n(move.wins2)} ${this.$tc(
        "wins",
        move.wins2
      )}`;
    },
    async queryBotSuggestions() {
      try {
        this.loadingBotMoves = true;

        const tps = this.tps;
        const uriEncodedTps = encodeURIComponent(tps);
        const komi = this.game.config.komi;
        const moveCount = this.botSettings.maxSuggestedMoves;
        const response = await fetch(
          `${bestMoveEndpoint}/${uriEncodedTps}?komi=${komi}&count=${moveCount}`
        );
        if (!response.ok) {
          return this.notifyError("HTTP-Error: " + response.status);
        }
        const { _debug } = await response.json();

        const botMoves = deepFreeze(
          _debug.map(({ mv: ptn, visits, winning_probability, pv }) => {
            let player = this.$store.state.game.position.turn;
            let color = this.$store.state.game.position.color;
            let ply = new Ply(ptn, { id: null, player, color });
            let followingPlies = pv.map((ply) => {
              ({ player, color } = this.nextPly(player, color));
              return new Ply(ply, { id: null, player, color });
            });
            let evaluation = 200 * (winning_probability - 0.5);
            return { ply, followingPlies, visits, evaluation };
          })
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
    async loadUsernames() {
      const response = await fetch(usernamesEndpoint);
      const { white, black } = await response.json();
      this.player1Index = new Fuse(white);
      this.player2Index = new Fuse(black);
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
        const databaseId = 1 * this.dbSettings.includeBotGames;
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
          white: this.dbSettings.player1 || null,
          black: this.dbSettings.player2 || null,
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
        console.log(data);

        const dbMoves = deepFreeze(
          data.moves.map((move, id) => {
            let ply = new Ply(move.ptn, { id: null, player, color });
            let wins1 = move.white;
            let wins2 = move.black;
            let totalGames = wins1 + wins2;
            let evaluation = 200 * (wins1 / totalGames - 0.5);
            return { id, ply, evaluation, totalGames, wins1, wins2 };
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
  mounted() {
    if (this.isVisible) {
      this.queryPosition();
      this.loadUsernames();
    }
  },
  watch: {
    isVisible(isVisible) {
      if (isVisible) {
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
