<template>
  <q-btn-group class="evaluation-buttons" v-bind="$attrs">
    <q-btn
      v-if="!$store.state.ui.embed"
      :color="autoAnnotateTak ? 'primary' : ''"
      :disable="!canAnnotateTak"
      @click="toggleAutoAnnotateTak"
      dense
      flat
    >
      <q-spinner v-if="takAnnotationProgress" size="xs" />
      <q-icon v-else name="annotate_tak" />
      <hint v-if="takAnnotationProgress">{{ $t("Cancel") }}</hint>
      <hint v-else>{{ $t("analysis.autoMarkTak") }}</hint>
    </q-btn>
    <q-btn
      v-if="!$store.state.ui.embed"
      :color="tinueSweepProgress ? 'primary' : ''"
      :disable="!canAnnotateTinue"
      @click.left="searchTinueHere"
      @click.right.prevent="sweepTinues"
      dense
      flat
    >
      <q-spinner v-if="tinueSweepProgress || tinueSearchInFlight" size="xs" />
      <q-icon v-else name="annotate_tinue" />
      <hint v-if="tinueSweepProgress">{{ $t("Cancel") }}</hint>
      <hint v-else>{{ $t("analysis.searchTinue") }}</hint>
    </q-btn>
    <q-btn
      :label="takTinueLabel"
      :color="isTak || isTinue ? 'primary' : ''"
      :disable="disable"
      @click.left="toggle('tak')"
      @click.right.prevent="toggle('tinue')"
      @shortkey="toggle($event.srcKey === 'double' ? 'tinue' : 'tak')"
      v-shortkey="{
        single: hotkeys.tak,
        double: hotkeys.tinue,
      }"
      dense
    />
    <q-btn
      :label="isDoubleQ ? '??' : '?'"
      :color="isQ || isDoubleQ ? 'primary' : ''"
      :disable="disable"
      @click.left="toggle('?')"
      @click.right.prevent="toggle('?', true)"
      @shortkey="toggle('?', $event.srcKey === 'double')"
      v-shortkey="{
        single: hotkeys.question,
        double: hotkeys.questionDouble,
      }"
      dense
    />
    <q-btn
      :label="isDoubleBang ? '!!' : '!'"
      :color="isBang || isDoubleBang ? 'primary' : ''"
      :disable="disable"
      @click.left="toggle('!')"
      @click.right.prevent="toggle('!', true)"
      @shortkey="toggle('!', $event.srcKey === 'double')"
      v-shortkey="{
        single: hotkeys.bang,
        double: hotkeys.bangDouble,
      }"
      dense
    />
    <q-btn icon="clear" :disable="!hasEvalMarks" @click="removeEvalMarks" dense>
      <hint v-if="hasEvalMarks">{{ $t("analysis.removeEvalMarks") }}</hint>
    </q-btn>
    <q-separator vertical />
    <q-btn
      @touchstart="vibrate"
      @click="deletePly"
      @shortkey="deletePly"
      v-shortkey="{
        delete: controlHotkeys.deletePly,
        backspace: controlHotkeys.backspacePly,
      }"
      :disable="deletePlyDisabled"
      icon="backspace"
    >
      <hint v-if="ply && !plyInProgress">
        {{ $t("Delete Ply") }}
      </hint>
    </q-btn>
  </q-btn-group>
</template>

<script>
import { HOTKEYS } from "../../keymap";
import { annotateGame, cancelAnnotation } from "../../bots/tak-annotator";
import {
  searchPosition as syntaksSearchPosition,
  sweepGame as syntaksSweepGame,
  cancelSweep as syntaksCancelSweep,
  cancelAll as syntaksCancelAll,
} from "../../bots/tinue-annotator";

export default {
  name: "EvalButtons",
  data() {
    return {
      hotkeys: HOTKEYS.EVAL,
      controlHotkeys: HOTKEYS.CONTROLS,
      takAnnotationProgress: null,
      tinueSweepProgress: null,
      tinueSearchInFlight: false,
    };
  },
  computed: {
    player() {
      return this.$store.state.game.config.player;
    },
    ply() {
      return this.$store.state.game
        ? this.$store.state.game.position.ply
        : null;
    },
    plyID() {
      return this.$store.state.game
        ? this.$store.state.game.position.plyID
        : null;
    },
    isBoardDisabled() {
      return this.$store.state.ui.disableBoard;
    },
    plyInProgress() {
      return this.$store.state.game.selected.pieces.length !== 0;
    },
    disable() {
      return !this.ply || (this.player && this.player !== this.ply.player);
    },
    deletePlyDisabled() {
      return (
        !this.ply ||
        this.plyInProgress ||
        this.isBoardDisabled ||
        this.isProtectedMainlinePly ||
        (this.player && this.ply.player !== this.player)
      );
    },
    isProtectedMainlinePly() {
      return this.$store.getters["game/isProtectedMainlinePly"](this.plyID);
    },
    evaluation() {
      return this.ply ? this.ply.evaluation : null;
    },
    isTak() {
      return this.evaluation && this.evaluation.tak;
    },
    isTinue() {
      return this.evaluation && this.evaluation.tinue;
    },
    takTinueLabel() {
      return this.isTinue ? '"' : "'";
    },
    isQ() {
      return this.evaluation && this.evaluation["?"];
    },
    isBang() {
      return this.evaluation && this.evaluation["!"];
    },
    isDoubleQ() {
      return this.evaluation && this.evaluation.isDouble["?"];
    },
    isDoubleBang() {
      return this.evaluation && this.evaluation.isDouble["!"];
    },
    canAnnotateTak() {
      const size =
        this.$store.state.game &&
        this.$store.state.game.config &&
        this.$store.state.game.config.size;
      return [4, 5, 6, 7].includes(size);
    },
    canAnnotateTinue() {
      const size =
        this.$store.state.game &&
        this.$store.state.game.config &&
        this.$store.state.game.config.size;
      return [5, 6, 7].includes(size);
    },
    autoAnnotateTak() {
      return this.$store.state.ui.autoAnnotateTak;
    },
    hasEvalMarks() {
      const game = this.$store.state.game;
      const allPlies = game && game.ptn && game.ptn.allPlies;
      if (!allPlies) return false;
      for (let i = 0; i < allPlies.length; i++) {
        const ply = allPlies[i];
        if (
          ply &&
          ply.evaluation &&
          (ply.evaluation.tak ||
            ply.evaluation.tinue ||
            ply.evaluation["?"] ||
            ply.evaluation["!"])
        ) {
          return true;
        }
      }
      return false;
    },
  },
  methods: {
    async markTak() {
      if (!this.canAnnotateTak) return;
      if (this.takAnnotationProgress) return;
      this.takAnnotationProgress = { done: 0, total: 0 };
      try {
        await annotateGame(this.$game, (progress) => {
          this.takAnnotationProgress = progress;
        });
      } finally {
        this.takAnnotationProgress = null;
      }
    },
    cancelTakAnnotation() {
      cancelAnnotation();
      this.takAnnotationProgress = null;
    },
    async searchTinueHere() {
      // If a sweep is running, the button acts as a cancel.
      if (this.tinueSweepProgress) {
        syntaksCancelSweep();
        this.tinueSweepProgress = null;
        return;
      }
      // If a single-position search is already running, terminate it
      // (deep search has no node budget; cancellation is hard-kill).
      if (this.tinueSearchInFlight) {
        await syntaksCancelAll();
        this.tinueSearchInFlight = false;
        return;
      }
      if (!this.canAnnotateTinue || !this.ply || !this.ply.tpsBefore) return;
      const size = this.$store.state.game.config.size;
      this.tinueSearchInFlight = true;
      const ply = this.ply;
      try {
        // Mark `"` per the formal Tinuë spec: solve at the position BEFORE
        // the ply (with the ply's player to move). If that's odd-ply Tinuë
        // and the played ply is the first move of a Tinuë sequence, the
        // move belongs on the road to Tinuë.
        const result = await syntaksSearchPosition(ply.tpsBefore, size);
        const isTinueMove =
          result.tinue &&
          Array.isArray(result.pv) &&
          result.pv.length > 0 &&
          ply.isEqual(result.pv[0]);
        if (isTinueMove) {
          this.$store.commit("game/ADD_TINUE_ANNOTATION", ply.id);
        }
      } catch (e) {
        // swallow — the user just lost the cache for this position.
      } finally {
        this.tinueSearchInFlight = false;
      }
    },
    async sweepTinues() {
      if (this.tinueSweepProgress) {
        syntaksCancelSweep();
        this.tinueSweepProgress = null;
        return;
      }
      if (!this.canAnnotateTinue) return;
      this.tinueSweepProgress = { done: 0, total: 0 };
      try {
        await syntaksSweepGame(this.$game, (progress) => {
          this.tinueSweepProgress = progress;
        });
      } finally {
        this.tinueSweepProgress = null;
      }
    },
    async toggleAutoAnnotateTak() {
      if (this.takAnnotationProgress) {
        this.cancelTakAnnotation();
        return;
      }
      const enabling = !this.autoAnnotateTak;
      this.$store.dispatch("ui/SET_UI", ["autoAnnotateTak", enabling]);
      if (enabling && this.canAnnotateTak) {
        await this.markTak();
      }
    },
    toggle(type, double = false) {
      this.$store.dispatch("game/TOGGLE_EVALUATION", { type, double });
    },
    removeEvalMarks() {
      if (!this.hasEvalMarks) return;
      this.$store.dispatch("game/REMOVE_EVAL_MARKS");
      this.notifyUndo({
        icon: "eval",
        message: this.$t("success.evalMarksRemoved"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    deletePly() {
      if (
        !this.ply ||
        this.plyInProgress ||
        this.isBoardDisabled ||
        this.isProtectedMainlinePly
      ) {
        return;
      }
      this.$store.dispatch("game/DELETE_PLY", this.plyID);
    },
    vibrate() {
      if (this.$store.state.ui.hapticNavControls && navigator.vibrate) {
        navigator.vibrate(2);
      }
    },
  },
};
</script>
