<template>
  <div class="notes column no-wrap">
    <component
      :is="recess ? 'recess' : 'div'"
      class="col-grow relative-position"
    >
      <q-scroll-area id="notes-scroll-area" class="absolute-fit">
        <q-virtual-scroll
          ref="scroll"
          class="bg-transparent"
          :items="plyIDs"
          scroll-target="#notes-scroll-area > .scroll"
          :virtual-scroll-item-size="128"
          :virtual-scroll-slice-ratio-before="0.5"
          :virtual-scroll-slice-ratio-after="0.5"
        >
          <template v-slot="{ item }">
            <NoteItem
              :class="{
                'q-pt-md': item < 0,
              }"
              :key="item"
              :ref="item"
              :plyID="item"
              :notes="log[item]"
              @edit="edit"
              @remove="remove"
            />
          </template>
        </q-virtual-scroll>
      </q-scroll-area>
      <q-resize-observer @resize="scroll" />
    </component>
    <q-toolbar class="bg-ui q-pa-none">
      <q-btn-group class="full-width" spread stretch flat unelevated>
        <q-btn @click="scrollToTop" icon="to_top" flat spread stretch>
          <hint>{{ $t("Top") }}</hint>
        </q-btn>
        <q-btn @click="jumpToCurrent" icon="to_current" flat spread stretch>
          <hint>{{ $t("Current") }}</hint>
        </q-btn>
        <q-btn @click="scrollToBottom" icon="to_bottom" flat spread stretch>
          <hint>{{ $t("Bottom") }}</hint>
        </q-btn>
        <q-separator vertical />
        <q-btn
          @click.stop="hideAnalysisNotes = !hideAnalysisNotes"
          icon="analysis"
          :color="hideAnalysisNotes ? '' : 'primary'"
          round
          dense
          flat
        >
          <hint>{{
            $t(
              hideAnalysisNotes ? "Show Analysis Notes" : "Hide Analysis Notes"
            )
          }}</hint>
        </q-btn>
        <q-btn icon="delete" :disable="!hasAnyNotes" flat spread stretch>
          <hint>{{ $t("Delete") }}</hint>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item
                clickable
                @click="removeCurrentPosition"
                :disable="!hasCurrentPositionNotes"
              >
                <q-item-section avatar>
                  <q-icon name="delete" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{
                    $t("Remove Current Positions Notes")
                  }}</q-item-label>
                </q-item-section>
              </q-item>

              <q-item clickable @click="removeAll" :disable="!hasAnyNotes">
                <q-item-section avatar>
                  <q-icon name="delete_all" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ $t("Remove All") }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-btn-group>
    </q-toolbar>
    <q-separator />
    <NoteInput ref="noteInput" @added="onNoteAdded" @edited="onNoteEdited" />
  </div>
</template>

<script>
import NoteItem from "./NoteItem";
import NoteInput from "./NoteInput";

import { pickBy } from "lodash";

export default {
  name: "Notes",
  components: { NoteItem, NoteInput },
  props: {
    recess: Boolean,
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    plies() {
      return this.game.ptn.allPlies;
    },
    branchPlies() {
      return this.game.ptn.branchPlies;
    },
    isShowing() {
      return this.$store.state.ui.textTab === "notes";
    },
    hideAnalysisNotes: {
      get() {
        return this.$store.state.ui.hideAnalysisNotes || false;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["hideAnalysisNotes", value]);
      },
    },
    unfilteredLog() {
      return this.$store.state.ui.showAllBranches &&
        !this.$store.state.ui.inlineBranches
        ? this.game.comments.notes
        : Object.freeze(
            pickBy(
              this.game.comments.notes,
              (notes, id) =>
                id < 0 || this.branchPlies.some((p) => p.id === 1 * id)
            )
          );
    },
    log() {
      if (!this.hideAnalysisNotes) {
        return this.unfilteredLog;
      }
      // Filter out analysis notes
      const filtered = {};
      for (const [plyID, notes] of Object.entries(this.unfilteredLog)) {
        const filteredNotes = notes.filter(
          (note) =>
            note.evaluation === null &&
            note.pv === null &&
            note.pvAfter === null
        );
        if (filteredNotes.length > 0) {
          filtered[plyID] = filteredNotes;
        }
      }
      return Object.freeze(filtered);
    },
    plyIDs() {
      return Object.freeze(
        Object.keys(this.log)
          .map((id) => 1 * id)
          .sort((a, b) => a - b)
      );
    },
    currentPlyID() {
      if (!this.log) {
        return null;
      }
      let plyID, ply;
      if (!this.game.position.plyID && !this.game.position.plyIsDone) {
        return this.plyIDs[0];
      } else if (this.game.position.ply) {
        if (this.game.position.plyID in this.log) {
          return this.game.position.plyID;
        } else if (this.isCurrent(-1)) {
          return -1;
        } else {
          for (let i = this.plyIDs.length - 1; i >= 0; i--) {
            plyID = this.plyIDs[i];
            ply = plyID in this.plies ? this.plies[plyID] : null;
            if (
              ply &&
              this.branchPlies.some((p) => p.id === ply.id) &&
              ply.index < this.game.position.ply.index
            ) {
              return plyID;
            }
          }
          return this.plyIDs[0];
        }
      }
      return null;
    },
    positionPlyID() {
      const pos = this.game.position;
      if (!pos.ply || (!pos.ply.index && !pos.plyIsDone)) {
        return -1;
      }
      return pos.plyID;
    },
    hasCurrentPositionNotes() {
      const plyID = this.positionPlyID;
      return plyID in this.game.comments.notes;
    },
    hasAnyNotes() {
      return Object.keys(this.game.comments.notes).length > 0;
    },
  },
  methods: {
    scrollToTop() {
      this.$refs.scroll.scrollTo(0);
    },
    scrollToBottom() {
      this.$refs.scroll.scrollTo(this.plyIDs.length - 1);
    },
    jumpToCurrent() {
      this.$nextTick(() => this.scroll());
    },
    edit({ plyID, index }) {
      const log = this.unfilteredLog[plyID][index];
      if (!this.isCurrent(plyID)) {
        this.$store.dispatch("game/GO_TO_PLY", { plyID, isDone: true });
      }
      this.$refs.noteInput.startEdit({ plyID, index, message: log.message });
    },
    scrollToNote(plyID) {
      const index = this.plyIDs.findIndex((id) => id === plyID);
      if (index >= 0) {
        this.$nextTick(() => this.$refs.scroll.scrollTo(index, "center-force"));
      }
    },
    onNoteAdded({ plyID }) {
      this.$nextTick(() => this.scrollToNote(plyID));
    },
    onNoteEdited({ plyID }) {
      this.$nextTick(() => this.scrollToNote(plyID));
    },
    remove({ plyID, index }) {
      this.$store.dispatch("game/REMOVE_NOTE", { plyID, index });
      this.notifyUndo({
        message: this.$t("success.noteRemoved"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    removeCurrentPosition() {
      const plyID = this.positionPlyID;
      const notes = this.game.comments.notes[plyID];
      if (notes && notes.length) {
        if (this.hideAnalysisNotes) {
          // Remove only non-analysis notes when analysis notes are hidden
          const indicesToRemove = notes
            .map((note, index) => ({ note, index }))
            .filter(
              ({ note }) =>
                note.evaluation === null &&
                note.pv === null &&
                note.pvAfter === null
            )
            .map(({ index }) => index)
            .reverse(); // Remove from end to preserve indices
          for (const index of indicesToRemove) {
            this.$store.dispatch("game/REMOVE_NOTE", { plyID, index });
          }
          if (indicesToRemove.length > 0) {
            this.notifyUndo({
              message: this.$t("success.removedAurrentPositionsNotes"),
              handler: () => {
                for (let i = 0; i < indicesToRemove.length; i++) {
                  this.$store.dispatch("game/UNDO");
                }
              },
            });
          }
        } else {
          this.$store.dispatch("game/REMOVE_POSITION_NOTES", plyID);
          this.notifyUndo({
            message: this.$t("success.removedAurrentPositionsNotes"),
            handler: () => {
              this.$store.dispatch("game/UNDO");
            },
          });
        }
      }
    },
    removeAll() {
      const hasNotes = Object.keys(this.game.comments.notes).length > 0;

      if (hasNotes) {
        if (this.hideAnalysisNotes) {
          // Remove only non-analysis notes when analysis notes are hidden
          let removedCount = 0;
          for (const [plyID, notes] of Object.entries(
            this.game.comments.notes
          )) {
            const indicesToRemove = notes
              .map((note, index) => ({ note, index }))
              .filter(
                ({ note }) =>
                  note.evaluation === null &&
                  note.pv === null &&
                  note.pvAfter === null
              )
              .map(({ index }) => index)
              .reverse();
            for (const index of indicesToRemove) {
              this.$store.dispatch("game/REMOVE_NOTE", {
                plyID: parseInt(plyID),
                index,
              });
              removedCount++;
            }
          }
          if (removedCount > 0) {
            this.notifyUndo({
              message: this.$t("success.removedAllNotes"),
              handler: () => {
                for (let i = 0; i < removedCount; i++) {
                  this.$store.dispatch("game/UNDO");
                }
              },
            });
          }
        } else {
          this.$store.dispatch("game/REMOVE_NOTES");
          this.notifyUndo({
            message: this.$t("success.removedAllNotes"),
            handler: () => {
              this.$store.dispatch("game/UNDO");
            },
          });
        }
      }
    },
    isCurrent(plyID) {
      return (
        this.game.position.plyID === plyID ||
        (plyID < 0 &&
          (!this.game.position.ply ||
            (!this.game.position.ply.index && !this.game.position.plyIsDone)))
      );
    },
    scroll() {
      const index = this.plyIDs.findIndex((id) => id === this.currentPlyID);
      if (index >= 0) {
        this.$nextTick(() => this.$refs.scroll.scrollTo(index, "center-force"));
      }
    },
  },
  watch: {
    log() {
      this.scroll();
    },
    currentPlyID() {
      this.scroll();
    },
  },
};
</script>

<style lang="scss">
.notes {
  .q-separator {
    opacity: 0.75;
  }

  .q-field ::selection {
    color: var(--q-color-primary) !important;
    background: var(--q-color-textDark) !important;
    body.primaryDark & {
      background: var(--q-color-textLight) !important;
    }
  }
}
</style>
