<template>
  <recess class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <div class="q-pa-md" v-if="show_bot_moves_panel">
        <q-card>
          <q-card-section>
            <div class="text-h6">{{ $t("openingExplorer.Bot Moves") }}</div>
            <div class="text-subtitle2">
              {{ analyzed_position_count }}
              {{ $t("openingExplorer.analyzed positions") }}
            </div>
          </q-card-section>
          <q-card-actions vertical>
            <q-btn
              color="primary"
              :flat="true"
              :loading="loading_bot_moves"
              @click="query_bot_suggestions"
            >
              Ask for suggestions
            </q-btn>
          </q-card-actions>
        </q-card>
        <div>
          <span v-if="loading_bot_moves">Loading...</span>
          <span v-else-if="applicable_bot_moves == null">Error, try again</span>
          <span v-else-if="!applicable_bot_moves.length">
            No suggested moves
          </span>
          <DatabaseEntry
            v-else
            v-for="move in applicable_bot_moves"
            class="q-mt-sm"
            :key="move.id"
            :ptn="move.ptn"
            :total_games="move.total_games"
            :white_wins="move.white_wins"
            :black_wins="move.black_wins"
            :following_moves="move.pv"
            total_label_suffix="visits"
            :ply_id="plyId"
          />
        </div>
      </div>
      <div class="q-pa-md" v-if="db_moves">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              {{ $t("openingExplorer.Database Moves") }}
              <q-checkbox
                v-model="includeBotGames"
                checked-icon="mdi-robot-happy"
                unchecked-icon="mdi-robot-dead-outline"
              >
                <hint>
                  Bot games {{ includeBotGames ? "included" : "excluded" }}
                </hint>
              </q-checkbox>
            </div>
            <div>
              <div class="row q-gutter-md">
                <q-select
                  class="col-5 col-grow"
                  v-model="searchSettings.white"
                  :options="whiteNames"
                  :loading="!whiteNames.length"
                  :label="$t('White')"
                  hide-bottom-space
                  clearable
                  filled
                  multiple
                  dense
                  hint="Must be an exact match"
                  hide-hint
                />
                <q-select
                  dense
                  class="col-5 col-grow"
                  v-model="searchSettings.black"
                  :options="blackNames"
                  :loading="!blackNames.length"
                  :label="$t('Black')"
                  hide-bottom-space
                  clearable
                  multiple
                  filled
                  hint="Must be an exact match"
                  hide-hint
                />
                <q-input
                  dense
                  class="col-grow col-6"
                  v-model="searchSettings.min_rating"
                  type="number"
                  max="5000"
                  step="10"
                  :min="dbMinRating"
                  label="Min Rating"
                  :hide-hint="dbMinRating <= searchSettings.min_rating"
                  :hint="`For these settings at least ${dbMinRating}`"
                  hide-bottom-space
                  filled
                >
                  <template v-slot:prepend>
                    <q-icon name="rating1" />
                  </template>
                </q-input>
                <q-input
                  dense
                  class="col-grow col-3"
                  v-model="searchSettings.max_suggested_moves"
                  type="number"
                  min="1"
                  step="1"
                  label="Moves"
                  hide-bottom-space
                  filled
                  hint="Maximum number of moves to display below"
                  hide-hint
                >
                </q-input>
                <q-select
                  dense
                  class="col-grow col-3"
                  v-model="searchSettings.komi"
                  :options="[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]"
                  label="Komi"
                  hide-bottom-space
                  filled
                  clearable
                  multiple
                  hint="Empty means ignore"
                  hide-hint
                />
              </div>
            </div>
            <div v-if="settings" class="text-subtitle2">
              <q-chip
                v-if="settings.white && settings.white.length"
                color="white"
                text-color="grey"
              >
                {{ settings.white.join(" / ") }}
              </q-chip>
              <q-chip
                v-if="settings.black && settings.black.length"
                color="black"
                text-color="grey"
              >
                {{ settings.black.join(" / ") }}
              </q-chip>
              <q-chip>elo >= {{ settings.min_rating }}</q-chip>
              <q-chip>
                {{ settings.include_bot_games ? "with bots" : "without bots" }}
              </q-chip>
              <q-chip>
                <span v-if="settings.komi && settings.komi.length">
                  {{ settings.komi.join(" / ") }}
                </span>
                <span v-else>any</span>
                &nbsp;komi
              </q-chip>
            </div>
            <div v-else>...</div>
          </q-card-section>
        </q-card>
        <DatabaseEntry
          class="q-mt-sm"
          v-for="move in db_moves"
          :key="move.id"
          :ptn="move.ptn"
          :total_games="move.total_games"
          :white_wins="move.white_wins"
          :black_wins="move.black_wins"
          :game="game"
          :ply_id="plyId"
        />
      </div>
      <div class="q-pa-md" v-if="db_games">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              {{ $t("openingExplorer.Top Games from Position") }}
            </div>
          </q-card-section>
        </q-card>
        <DatabaseGame
          class="q-mt-sm"
          v-for="game in db_games"
          :key="game.id"
          :ptn="game.ptn"
          :playtak_id="game.playtak_id"
          :white_player="game.white_player"
          :black_player="game.black_player"
          :white_rating="game.white_rating"
          :black_rating="game.black_rating"
          :result="game.result"
          :date="game.date"
          :komi="game.komi"
        />
      </div>
    </q-scroll-area>
  </recess>
</template>

<script>
import { timestampToDate } from "../../utilities";
import DatabaseEntry from "../database/DatabaseEntry";
import DatabaseGame from "../database/DatabaseGame";

const apiUrl = `https://openings.exegames.de/api/v1`;
// const apiUrl = `http://127.0.0.1:5000/api/v1`;
const bestMoveEndpoint = `${apiUrl}/best_move`;
const openingsEndpoint = `${apiUrl}/opening`;
const usernamesEndpoint = `${apiUrl}/players`;

export default {
  name: "GamesDB",
  components: { DatabaseEntry, DatabaseGame },
  props: {
    game: Object,
    recess: Boolean,
  },
  data() {
    const queryParams = new URL(window.location).searchParams;

    return {
      show_bot_moves_panel: Boolean(queryParams.get("show_bot_moves_panel")),
      loading_bot_moves: false,
      bot_moves: {}, // maps TPS-String to array of moves that were suggested for that position
      db_moves: [],
      db_games: [],
      includeBotGames: false,
      settings: null,
      searchSettings: {
        white: [],
        black: [],
        min_rating: 1200,
        max_suggested_moves: 8,
        komi: [],
      },
      dbConfig: { min_rating: 1200 },
      blackNames: [],
      whiteNames: [],
    };
  },
  computed: {
    dbMinRating() {
      return this.dbConfig.min_rating || 1000;
    },
    plyId() {
      return this.$store.state.game.position.plyID;
    },
    tps() {
      //  do not use this$.game.position.tps as it's not watchable
      return this.$store.state.game.position.tps;
    },
    applicable_bot_moves() {
      const tps = this.tps;
      const moves = this.bot_moves[tps];
      if (moves || moves == []) {
        return moves;
      }
      return null; // indicates no moves were loaded
    },
    analyzed_position_count() {
      return this.bot_moves ? Object.keys(this.bot_moves) : 0;
    },
  },
  methods: {
    async query_bot_suggestions() {
      try {
        this.loading_bot_moves = true;

        const tps = this.tps;
        const uriEncodedTps = encodeURIComponent(tps);
        const komi = this.game.config.komi;
        const moveCount = 8; // todo make configurable
        const response = await fetch(
          `${bestMoveEndpoint}/${uriEncodedTps}?komi=${komi}&count=${moveCount}`
        );
        if (!response.ok) {
          return alert("HTTP-Error: " + response.status);
        }
        const { moves, _debug } = await response.json();

        const mvs = _debug.map(
          ({ mv: ptn, visits, winning_probability, pv }, id) => ({
            id,
            ptn,
            pv,
            subtitle: pv.join(" "),
            total_games: visits,
            white_wins: winning_probability * visits,
            black_wins: (1 - winning_probability) * visits,
          })
        );
        this.$set(this.bot_moves, tps, mvs); // this.bot_moves[tps] = moves; but with vue reactivity

        console.log("bot moves map", this.bot_moves);
      } finally {
        this.loading_bot_moves = false;
      }
    },
    async loadUsernames() {
      const response = await fetch(usernamesEndpoint);
      const { white, black } = await response.json();
      this.blackNames = black;
      this.whiteNames = white;
    },
    async query_position() {
      this.settings = null;
      const databaseId = this.includeBotGames ? 1 : 0;
      const max_suggested_moves = parseInt(
        this.searchSettings.max_suggested_moves || 20
      );
      const komi = this.searchSettings.komi;
      const settings = {
        white: this.searchSettings.white,
        black: this.searchSettings.black,
        min_rating: parseInt(this.searchSettings.min_rating || 0),
        include_bot_games: this.includeBotGames,
        max_suggested_moves,
        komi,
      };
      const uriEncodedTps = encodeURIComponent(this.tps);
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
        return alert("HTTP-Error: " + response.status);
      }
      const data = await response.json();
      console.log("search settings", settings);
      console.log("result settings", data.settings);
      this.settings = data.settings;
      this.dbConfig = data.config;

      this.db_moves.splice(data.moves.length, this.db_moves.length);
      let i = 0;
      for (const move of data.moves) {
        const new_move = {
          id: i,
          ptn: move.ptn,
          total_games: move.white + move.black,
          white_wins: move.white,
          black_wins: move.black,
        };
        if (i < this.db_moves.length) {
          this.db_moves.splice(i, 1, new_move);
        } else {
          this.db_moves.push(new_move);
        }
        i++;
      }

      this.db_games.splice(0, this.db_games.length);
      i = 0;
      for (const game of data.games || []) {
        const new_game = {
          id: i,
          ptn: game.ptn,
          playtak_id: game.playtak_id,
          white_player: game.white.name,
          black_player: game.black.name,
          white_rating: game.white.rating,
          black_rating: game.black.rating,
          result: game.result,
          date: timestampToDate(game.date),
          komi: game.komi,
        };
        this.db_games.push(new_game);
        i++;
      }
    },
  },
  mounted() {
    this.query_position();
    this.loadUsernames();
  },
  watch: {
    tps() {
      this.query_position();
    },
    includeBotGames() {
      this.query_position();
    },
    searchSettings: {
      handler() {
        this.query_position();
      },
      deep: true,
    },
  },
};
</script>
