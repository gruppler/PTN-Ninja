<template>
  <q-dialog
    :value="true"
    ref="dialog"
    @hide="hide"
    content-class="eval-graph"
    v-bind="$attrs"
    no-route-dismiss
    maximized
  >
    <div class="fit flex flex-center" @click="$refs.dialog.hide()">
      <img
        v-if="src"
        @click.stop
        ref="output"
        :src="src"
        :alt="filename"
        :title="filename"
      />
    </div>
  </q-dialog>
</template>

<script>
import { renderEvaluationGraphPNG } from "../utils/evalGraph";
import { normalizeWDL } from "../bots/wdl";
import { PTNtoTPS } from "tps-ninja";

export default {
  name: "EvalGraph",
  props: {
    goBack: Boolean,
  },
  data() {
    return {
      src: "",
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    branchPlies() {
      return this.game.ptn.branchPlies;
    },
    filename() {
      return this.$store.getters["ui/evalGraphFilename"]({
        name: this.game.name,
      });
    },
    evaluations() {
      const getEvalForTps = this.$store.getters["game/evaluationForTps"];
      const getWdlForTps = this.$store.getters["game/wdlForTps"];
      if (!getEvalForTps) return [];

      const plies = this.branchPlies;
      const startTps = this.game.ptn.tags.tps
        ? this.game.ptn.tags.tps.text
        : null;
      const size = this.game.config.size;

      // Walk the current branch in order so saved evaluations resolve even
      // for plies that haven't been navigated yet (no cached tpsAfter).
      let prevTps = startTps;
      return plies.map((ply) => {
        let tps = ply && ply.tpsAfter;
        if (!tps && ply) {
          try {
            tps = PTNtoTPS({ size, tps: prevTps, plies: [ply.text] });
          } catch (error) {
            tps = null;
          }
        }
        prevTps = tps || prevTps;

        // Match the PTN panel's eval bar (see PTN/Move.vue getEvalBar +
        // WdlBar player1Percent): prefer the WDL-derived player1 win share
        // (player1 + draw / 2) and only fall back to the raw evaluation
        // when no WDL data is available.
        const evaluation = tps ? getEvalForTps(tps) : null;
        const wdl = tps && getWdlForTps ? getWdlForTps(tps) : null;
        const normalizedWdl = normalizeWDL(wdl, evaluation);
        if (normalizedWdl) {
          const pct = normalizedWdl.player1 + normalizedWdl.draw / 2;
          return Math.max(-1, Math.min(1, (pct - 50) / 50));
        }
        if (Number.isFinite(evaluation)) {
          return Math.max(-1, Math.min(1, evaluation / 100));
        }
        // Fall back to the ply's result on game-ending plies the same way
        // the PTN panel's eval bar does (see PTN/Move.vue getEvalBar).
        if (ply && ply.result && ply.result.type !== "1") {
          if (ply.result.isTie) return 0;
          return ply.result.winner === 1 ? 1 : -1;
        }
        return null;
      });
    },
  },
  methods: {
    hide() {
      if (this.goBack) {
        this.$router.back();
      }
    },
    async render() {
      if (!this.evaluations.some((v) => v !== null)) {
        this.notifyError(this.$t("No evaluations available"));
        this.$refs.dialog.hide();
        return;
      }
      try {
        const blob = await renderEvaluationGraphPNG({
          evaluations: this.evaluations,
        });
        if (this.src) URL.revokeObjectURL(this.src);
        this.src = URL.createObjectURL(blob);
      } catch (error) {
        this.notifyError(error);
        this.$refs.dialog.hide();
      }
    },
  },
  mounted() {
    this.render();
  },
  beforeDestroy() {
    if (this.src) URL.revokeObjectURL(this.src);
  },
};
</script>

<style lang="scss">
.eval-graph {
  img {
    pointer-events: all;
    display: block;
    max-width: 100vw;
    max-height: 100vh;
    width: auto;
    height: auto;
  }
}
</style>
