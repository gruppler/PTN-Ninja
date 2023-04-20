<template>
  <recess class="col-grow relative-position">
    <q-scroll-area ref="scroll" class="games-db absolute-fit">
      <!-- Bot Suggestions -->
      <q-expansion-item
        v-if="showBotMovesPanel"
        v-model="sections.botSuggestions"
        :label="$t('analysis.Bot Moves')"
        icon="bot"
        header-class="bg-accent"
      >
        <smooth-reflow>
          <q-btn
            v-if="!applicableBotMoves"
            @click="queryBotSuggestions"
            :loading="loadingBotMoves"
            class="full-width"
            color="primary"
            stretch
          >
            {{ $t("analysis.Ask for suggestions") }}
          </q-btn>
          <AnalysisItem
            v-else
            v-for="(move, i) in applicableBotMoves"
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
        :label="$t('analysis.Database Moves')"
        icon="database"
        header-class="bg-accent"
      >
        <smooth-reflow>
          <AnalysisItem
            v-for="(move, i) in dbMoves"
            :key="i"
            :ply="move.ply"
            :evaluation="move.evaluation"
            :count="move.totalGames"
            count-label="analysis.games"
            :player1-number="$n(move.wins1, 'n0')"
            :player2-number="$n(move.wins2, 'n0')"
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
          <DatabaseGame
            v-for="(game, i) in dbGames"
            :key="i"
            :playtak-id="game.playtakId"
            :player1="game.player1"
            :player2="game.player2"
            :rating1="game.rating1"
            :rating2="game.rating2"
            :result="game.result"
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

const bestMoveEndpoint = `https://openings.exegames.de/api/v1/best_move`;
const openingsEndpoint = `https://openings.exegames.de/api/v1/opening`;

export default {
  name: "Analysis",
  components: { AnalysisItem, DatabaseGame },
  props: {
    game: Object,
    recess: Boolean,
  },
  data() {
    const queryParams = new URL(window.location).searchParams;

    return {
      showBotMovesPanel: true,
      loadingBotMoves: false,
      loadingDBMoves: false,
      botMoves: {}, // maps TPS-String to array of moves that were suggested for that position
      dbMoves: [],
      dbGames: [],
      sections: { ...this.$store.state.ui.analysisSections },
    };
  },
  computed: {
    ply() {
      return this.$store.state.game.position.ply;
    },
    tps() {
      //  do not use this.$game.position.tps as it's not watchable
      return this.$store.state.game.position.tps;
    },
    applicableBotMoves() {
      return this.botMoves[this.tps] || null;
    },
  },
  methods: {
    nextPly(player, color) {
      player = player === 1 ? 2 : 1;
      color = color === 1 ? 2 : 1;
      return { player, color };
    },
    formatEvaluation(v) {
      return `${this.$n(Math.abs(v), "n2")}%`;
    },
    async queryBotSuggestions() {
      try {
        this.loadingBotMoves = true;

        const tps = this.tps;
        const uriEncodedTps = encodeURIComponent(tps);
        const komi = this.game.config.komi;
        const moveCount = 8; // todo make configurable
        const response = await fetch(
          `${bestMoveEndpoint}/${uriEncodedTps}?komi=${komi}&count=${moveCount}`
        );
        if (!response.ok) {
          return this.notifyError("HTTP-Error: " + response.status);
        }
        const { _debug } = await response.json();

        const moves = _debug.map(
          ({ mv: ptn, visits, winning_probability, pv }) => {
            let player = this.ply.player;
            let color = this.ply.color;
            ({ player, color } = this.nextPly(player, color));
            let ply = new Ply(ptn, { id: null, player, color });
            let followingMoves = pv.map((ply) => {
              ({ player, color } = this.nextPly(player, color));
              return new Ply(ply, { id: null, player, color });
            });
            let evaluation = 200 * (winning_probability - 0.5);
            return { ply, followingMoves, visits, evaluation };
          }
        );
        // this.botMoves[tps] = moves; but with vue reactivity
        this.$set(this.botMoves, tps, moves);
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loadingBotMoves = false;
      }
    },
    async queryPosition() {
      try {
        this.loadingDBMoves = true;

        const uriEncodedTps = encodeURIComponent(this.tps);
        const response = await fetch(`${openingsEndpoint}/${uriEncodedTps}`);
        if (!response.ok) {
          return this.notifyError("HTTP-Error: " + response.status);
        }
        const data = await response.json();

        this.dbMoves = data.moves.map((move, id) => {
          let player = this.ply.player;
          let color = this.ply.color;
          ({ player, color } = this.nextPly(player, color));
          let ply = new Ply(move.ptn, { id: null, player, color });
          let wins1 = move.white;
          let wins2 = move.black;
          let totalGames = wins1 + wins2;
          let evaluation = 200 * (wins1 / totalGames - 0.5);
          return { id, ply, evaluation, totalGames, wins1, wins2 };
        });

        this.dbGames = (data.games || []).map((game) => ({
          playtakId: game.playtak_id,
          player1: game.white.name,
          player2: game.black.name,
          rating1: game.white.rating,
          rating2: game.black.rating,
          result: game.result,
        }));
      } catch (error) {
        this.notifyError(error);
      } finally {
        this.loadingDBMoves = false;
      }
    },
  },
  mounted() {
    this.queryPosition();
  },
  watch: {
    tps() {
      this.queryPosition();
    },
    sections: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["analysisSections", value]);
      },
      deep: true,
    },
  },
};
</script>
