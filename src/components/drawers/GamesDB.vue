<template>
  <recess>
    <q-scroll-area ref="scroll" class="games-db absolute-fit non-selectable">
      <q-field helper="Path to data store">
        <input
          type="file"
          id="dataPath"
          v-on:change="loadCSVFromFile"
          ref="fileInput"
          hidden
        />
      </q-field>
      <q-btn v-on:click="selectPath">{{ $t("load database") }}</q-btn>
      <q-btn
        type="a"
        href="https://github.com/Skoolin/TAKexplorer/releases/download/refs%2Fheads%2Fmaster/db_dump"
        label="download"
      />
      <div class="q-pa-md" v-if="db_moves">
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
    </q-scroll-area>
  </recess>
</template>

<script>
import DatabaseEntry from "../../database/DatabaseEntry";
import read_dump from "../../openingDB/csv_reader";
import symmetry_normalizer from "../../openingDB/symmetry_normalizer";

export default {
  name: "GamesDB",
  components: { DatabaseEntry },
  props: {
    game: Object,
    recess: Boolean,
  },
  data() {
    return {
      db_moves: [],
    };
  },
  methods: {
    selectPath() {
      console.log("Selecting path for data store");

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
              id: parseInt(m[0]),
              ptn: m_ptn,
              total_games: w_win + b_win,
              white_wins: w_win,
              black_wins: b_win,
            });
          }
        });
        this.db_moves.splice(0, this.db_moves.length);
        new_moves = new_moves.sort((a, b) => {
          return b.total_games - a.total_games;
        });
        this.db_moves.push(...new_moves);
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
    this.query_position();
  },
};
</script>
