<template>
  <q-expansion-item
    v-model="sections.positionNotes"
    header-class="bg-accent"
    expand-icon-class="fg-inherit"
  >
    <template v-slot:header>
      <q-item-section avatar>
        <q-icon name="notes" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ $t("Notes") }}</q-item-label>
      </q-item-section>
      <q-item-section class="fg-inherit" side>
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
      </q-item-section>
    </template>

    <recess>
      <smooth-reflow>
        <div v-if="filteredNotes.length" class="position-notes-list">
          <Note
            v-for="note in filteredNotes"
            :key="`note-${positionPlyID}-${note.originalIndex}`"
            :plyID="positionPlyID"
            :index="note.originalIndex"
            :comment="note"
            @edit="edit"
            @remove="remove"
            class="q-px-md q-py-xs"
          />
        </div>
        <q-item v-else class="flex-center" :class="textClass">
          {{ $t("No notes for this position") }}
        </q-item>
      </smooth-reflow>

      <q-separator />

      <NoteInput ref="noteInput" />
    </recess>
  </q-expansion-item>
</template>

<script>
import Note from "./Note";
import NoteInput from "./NoteInput";
import { cloneDeep } from "lodash";

export default {
  name: "PositionNotes",
  components: { Note, NoteInput },
  data() {
    return {
      sections: cloneDeep(this.$store.state.ui.analysisSections),
    };
  },
  computed: {
    game() {
      return this.$store.state.game;
    },
    textClass() {
      return this.$store.state.ui.theme.panelDark
        ? "text-textLight"
        : "text-textDark";
    },
    positionPlyID() {
      const pos = this.game.position;
      if (!pos.ply || (!pos.ply.index && !pos.plyIsDone)) {
        return -1;
      }
      return pos.plyID;
    },
    allNotes() {
      return this.game.comments.notes[this.positionPlyID] || [];
    },
    hideAnalysisNotes: {
      get() {
        return this.$store.state.ui.hideAnalysisNotes || false;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["hideAnalysisNotes", value]);
      },
    },
    filteredNotes() {
      if (!this.hideAnalysisNotes) {
        return this.allNotes.map((note, index) => ({
          ...note,
          originalIndex: index,
        }));
      }
      return this.allNotes
        .map((note, index) => ({
          ...note,
          originalIndex: index,
        }))
        .filter(
          (note) =>
            note.evaluation === null &&
            note.pv === null &&
            note.pvAfter === null
        );
    },
  },
  methods: {
    edit({ plyID, index }) {
      const notes = this.game.comments.notes[plyID];
      if (!notes || !notes[index]) return;
      const note = notes[index];
      this.$refs.noteInput.startEdit({ plyID, index, message: note.message });
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
  },
  watch: {
    sections: {
      handler(value) {
        this.$store.dispatch("ui/SET_UI", ["analysisSections", value]);
      },
      deep: true,
    },
  },
};
</script>

<style lang="scss">
.position-notes-list {
  .q-message:not(:last-child) {
    margin-bottom: 3px;
    .q-message-text {
      border-radius: $generic-border-radius;
      min-height: 2em;
      &:before {
        display: none;
      }
    }
  }
}
</style>
