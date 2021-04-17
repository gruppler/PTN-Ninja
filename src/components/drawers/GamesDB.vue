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
import read_dump from "../../openingDB/csv_reader";
import symmetry_normalizer from "../../openingDB/symmetry_normalizer";

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
    selectPath() {
      this.$refs.fileInput.click();
    },

    async loadCSVFromFile(ev) {
      const file = ev.target.files[0];
      const reader = new FileReader();

      reader.onload = (e) =>
        read_dump(e.target.result, (pos, games, moves, refs) => {
          this.positions = pos;
          this.positions.splice(0, 1);
          this.games = games;
          this.games.splice(0, 1);
          this.moves = moves;
          this.moves.splice(0, 1);
          this.refs = refs;
          this.refs.splice(0, 1);
        });
      await reader.readAsText(file);

      await this.query_position();
    },

    async cache_db() {
      let url = "/resources/db_dump";
      await caches.delete("v1");
      let cache = await caches.open("v2");
      let cached_db = await cache.match(url);

      if (cached_db === undefined) {
        console.log("no database cached, loading new one...");
        await cache.add(url);
        cached_db = await cache.match(url);
      }

      let txt = await cached_db.text();
      read_dump(txt, (pos, games, moves, refs) => {
        this.positions = pos;
        this.positions.splice(0, 1);
        this.games = games;
        this.games.splice(0, 1);
        this.moves = moves;
        this.moves.splice(0, 1);
        this.refs = refs;
        this.refs.splice(0, 1);
      });

      await this.query_position();
    },

    async query_position() {
      let tps = this.game.state.tps.split(" ")[0];
      let o_id = symmetry_normalizer.get_tps_orientation(tps);
      let t_tps = symmetry_normalizer.transform_tps(tps, o_id);

      if (this.positions) {
        let position_id = -1;
        for (let i = 0; i < this.positions.length; i++) {
          let p_tps = this.positions[i][1];
          let p_id = this.positions[i][0];
          if (t_tps === p_tps) {
            position_id = p_id;
            break;
          }
        }
        let move_pos_ids = [];
        let new_moves = [];
        this.moves.forEach((m) => {
          if (
            m[2] === position_id &&
            !move_pos_ids.includes(m[3]) &&
            m[4].length < 10
          ) {
            move_pos_ids.push(m[3]);
            let w_win = parseInt(m[6]);
            let b_win = parseInt(m[5]);
            let t_m_ptn = m[4];
            let m_ptn = symmetry_normalizer.transposed_transform_move(
              t_m_ptn,
              o_id
            );
            new_moves.push({
              ptn: m_ptn,
              total_games: w_win + b_win,
              white_wins: w_win,
              black_wins: b_win,
            });
          }
        });
        this.db_moves.splice(new_moves.length, this.db_moves.length);
        new_moves = new_moves.sort((a, b) => {
          return b.total_games - a.total_games;
        });
        let i = 0;
        for (let new_move of new_moves) {
          new_move.id = i;
          if (i < this.db_moves.length) {
            this.db_moves.splice(i, 1, new_move);
          } else {
            this.db_moves.push(new_move);
          }
          i++;
        }

        let games_in_position = [];
        let found_game = false;

        for (let ref of this.refs) {
          let game_id = parseInt(ref[1]);
          let pos_id = parseInt(ref[2]);
          if (pos_id == position_id) {
            let game = this.games[game_id - 1];
            if (game) {
              games_in_position.push(this.games[game_id - 1]);
            }
            found_game = true;
          }
        }

        let best_game = undefined;
        let best_rating = 0;

        for (let game of games_in_position) {
          let new_rating = parseInt(game[7]) + parseInt(game[8]);
          if (new_rating > best_rating) {
            best_rating = new_rating;
            best_game = game;
          }
        }

        this.db_games.splice(0, this.db_games.length);
        if (best_game) {
          best_game = {
            id: 0,
            ptn: best_game[6],
            playtak_id: parseInt(best_game[2]),
            white_player: best_game[3],
            black_player: best_game[4],
            white_rating: parseInt(best_game[7]),
            black_rating: parseInt(best_game[8]),
            result: best_game[5],
          };
          this.db_games.push(best_game);
        }
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
  mounted() {
    this.cache_db();
  },
};
</script>
