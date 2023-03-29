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
            <q-btn
              flat
              :loading="loading_bot_moves"
              @click="query_bot_suggestions"
            >
              Ask for suggestions
            </q-btn>
          </q-card-section>
        </q-card>
        <div>
          <span v-if="loading_bot_moves">Loading...</span>
          <span v-else-if="applicable_bot_moves == null">Error, try again</span>
          <span v-else-if="!applicable_bot_moves.length">
            No suggested moves
          </span>
          <DatabaseEntry
            v-else
            class="q-mt-sm"
            v-for="move in applicable_bot_moves"
            :key="move.id"
            :ptn="move.ptn"
            :total_games="move.total_games"
            :white_wins="move.white_wins"
            :black_wins="move.black_wins"
            :game="game"
            total_label_suffix="visits"
          />
        </div>
      </div>
      <div class="q-pa-md" v-if="db_moves">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              {{ $t("openingExplorer.Database Moves") }}
            </div>
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
        />
      </div>
    </q-scroll-area>
  </recess>
</template>

<script>
import DatabaseEntry from "../database/DatabaseEntry";
import DatabaseGame from "../database/DatabaseGame";

const bestMoveEndpoint = `http://127.0.0.1:5000/api/v1/best_move`;
const openingsEndpoint = `https://openings.exegames.de/api/v1/opening`;

export default {
  name: "GamesDB",
  components: { DatabaseEntry, DatabaseGame },
  props: {
    game: Object,
    recess: Boolean,
  },
  data() {
    return {
      show_bot_moves_panel: false,
      loading_bot_moves: false,
      bot_moves: {}, // maps TPS-String to array of moves that were suggested for that position
      db_moves: [],
      db_games: [],
      // equivalent to game.state.tps, but watchable by Vue and thus
      // changes trigger re-render of bot moves
      reactiveTps: this.getTps(),
    };
  },
  computed: {
    applicable_bot_moves() {
      const tps = this.reactiveTps;
      return this.bot_moves[tps] ?? [];
    },
    analyzed_position_count() {
      return Object.keys(this.bot_moves).length;
    },
  },
  methods: {
    getTps() {
      return this.game.state.tps;
    },
    async query_bot_suggestions() {
      try {
        this.loading_bot_moves = true;

        const tps = this.reactiveTps;
        const uriEncodedTps = encodeURIComponent(tps);
        const komi = this.game.tag("komi");
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
    async query_position() {
      const uriEncodedTps = encodeURIComponent(this.reactiveTps);
      const response = await fetch(`${openingsEndpoint}/${uriEncodedTps}`);

      if (!response.ok) {
        return alert("HTTP-Error: " + response.status);
      }
      const data = await response.json();

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
      for (const game of data.games ?? []) {
        console.log(game);
        const new_game = {
          id: i,
          ptn: game.ptn,
          playtak_id: game.playtak_id,
          white_player: game.white.name,
          black_player: game.black.name,
          white_rating: game.white.rating,
          black_rating: game.black.rating,
          result: game.result,
        };
        this.db_games.push(new_game);
        i++;
      }
    },
  },
  watch: {
    game() {
      this.query_position();
    },
    "game.state.plyID"() {
      this.query_position();
    },
    "game.state.plyIsDone"() {
      this.query_position();
    },
    "game.state.tps"() {
      this.reactiveTps = this.getTps();
    },
  },
};
</script>
