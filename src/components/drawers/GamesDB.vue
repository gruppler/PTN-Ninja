<template>
  <recess class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <div class="q-pa-md" v-if="db_moves">
        <q-card> {{ $t("Database Moves") }}: </q-card>
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
        <q-card> {{ $t("Top Games from Position") }}: </q-card>
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

export default {
  name: "GamesDB",
  components: { DatabaseEntry, DatabaseGame },
  props: {
    game: Object,
    recess: Boolean,
  },
  data() {
    return {
      db_moves: [],
      db_games: [],
    };
  },
  methods: {

    async query_position() {
      let tps = this.game.state.tps
      console.log(tps)
      tps = tps.replaceAll(",","%2C")
      tps = tps.replaceAll(" ","%20")

      let response = await fetch("http://127.0.0.1:5000/api/v1/opening/"+tps);

      if(response.ok) {
        let data = await(response.json());

        this.db_moves.splice(data.moves.length, this.db_moves.length);
        let i = 0;
        for(let move of data.moves) {
          let new_move = {
            id: i,
            ptn: move.ptn,
            total_games: move.white+move.black,
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
        for(let game of data.games) {
          console.log(game)
          let new_game = {
            id: i,
            ptn: game.ptn,
            playtak_id: game.playtak_id,
            white_player: game.white.name,
            black_player: game.black.name,
            white_rating: game.white.rating,
            black_rating: game.black.rating,
          }
          this.db_games.push(new_game);
          i++;
        }
      } else {
        alert("HTTP-Error: " + response.status);
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
  },
};
</script>
