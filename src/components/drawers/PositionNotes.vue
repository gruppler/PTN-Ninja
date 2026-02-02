<template>
  <q-expansion-item
    v-model="expanded"
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
        <div
          v-if="filteredNotes.length"
          ref="notesList"
          class="position-notes-list q-px-md q-pt-md"
        >
          <Note
            v-for="note in filteredNotes"
            :key="`note-${positionPlyID}-${note.originalIndex}`"
            :ref="`note-${note.originalIndex}`"
            :plyID="positionPlyID"
            :index="note.originalIndex"
            :comment="note"
            @edit="edit"
            @remove="remove"
          />
        </div>
        <q-item v-else class="flex-center" :class="textClass">
          {{ $t("No notes for this position") }}
        </q-item>
      </smooth-reflow>

      <NoteInput
        ref="noteInput"
        @added="onNoteAdded"
        @edited="onNoteEdited"
        style="position: sticky; bottom: 0"
      />
    </recess>
  </q-expansion-item>
</template>

<script>
import Note from "./Note";
import NoteInput from "./NoteInput";
export default {
  name: "PositionNotes",
  components: { Note, NoteInput },
  data() {
    return {
      expanded: this.$store.state.ui.analysisSections.positionNotes,
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
    scrollToNote(originalIndex) {
      // Wait for DOM and smooth-reflow animation to complete
      this.$nextTick(() => {
        // Delay to allow smooth-reflow CSS transitions to complete (0.3s = 300ms)
        setTimeout(() => {
          const noteRef = this.$refs[`note-${originalIndex}`];
          if (noteRef) {
            // noteRef is an array when using v-for refs
            const component = Array.isArray(noteRef) ? noteRef[0] : noteRef;
            if (component && component.$el) {
              // Find the q-scroll-area container (parent Analysis component)
              const scrollContainer = component.$el.closest(
                ".q-scrollarea__container"
              );
              if (scrollContainer) {
                // Use getBoundingClientRect for accurate positioning
                const containerRect = scrollContainer.getBoundingClientRect();
                const elementRect = component.$el.getBoundingClientRect();
                const currentScrollTop = scrollContainer.scrollTop;
                // Calculate element's position relative to container
                const elementTopRelative =
                  elementRect.top - containerRect.top + currentScrollTop;
                const containerHeight = scrollContainer.clientHeight;
                const elementHeight = elementRect.height;
                // Scroll to center the element
                scrollContainer.scrollTo({
                  top:
                    elementTopRelative -
                    containerHeight / 2 +
                    elementHeight / 2,
                  behavior: "smooth",
                });
              } else {
                // Fallback to scrollIntoView if no scroll container found
                component.$el.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }
          }
        }, 250);
      });
    },
    onNoteAdded() {
      // Scroll to the last note (newly added)
      // Wait for Vue to update the DOM after the store change
      this.$nextTick(() => {
        this.$nextTick(() => {
          if (this.filteredNotes.length > 0) {
            const lastNote = this.filteredNotes[this.filteredNotes.length - 1];
            this.scrollToNote(lastNote.originalIndex);
          }
        });
      });
    },
    onNoteEdited({ index }) {
      this.scrollToNote(index);
    },
  },
  watch: {
    expanded(value) {
      const sections = { ...this.$store.state.ui.analysisSections };
      if (sections.positionNotes !== value) {
        sections.positionNotes = value;
        this.$store.dispatch("ui/SET_UI", ["analysisSections", sections]);
      }
    },
    "$store.state.ui.analysisSections.positionNotes"(value) {
      if (this.expanded !== value) {
        this.expanded = value;
      }
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
