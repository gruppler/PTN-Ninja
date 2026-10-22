<template>
  <div class="notes column no-wrap">
    <!-- Notes only: laid out like chat, with the input at the bottom -->
    <template v-if="notesOnly">
      <component
        :is="recess ? 'recess' : 'div'"
        class="col-grow relative-position"
      >
        <q-scroll-area id="notes-scroll-area" class="absolute-fit notes-scroll">
          <NoteItem
            v-for="plyID in currentPlyIDs"
            :key="plyID"
            :ref="'note-' + plyID"
            :plyID="plyID"
            :notes="currentLog[plyID]"
            @edit="edit"
            @remove="remove"
          />
          <q-item
            v-if="!currentPlyIDs.length"
            class="flex-center text-center"
            :class="textClass"
          >
            {{ $t("No notes for this position") }}
          </q-item>
        </q-scroll-area>
      </component>
      <NoteInput
        ref="noteInput"
        class="bg-ui"
        @added="onNoteAdded"
        @edited="onNoteEdited"
      />
    </template>

    <component
      v-else
      :is="recess ? 'recess' : 'div'"
      class="col-grow relative-position"
    >
      <q-scroll-area id="notes-scroll-area" class="absolute-fit notes-scroll">
        <q-expansion-item
          v-model="sections.positionNotes"
          header-class="bg-accent"
          expand-icon-class="fg-inherit"
          default-opened
        >
          <template v-slot:header>
            <q-item-section avatar>
              <q-icon name="notes" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ $t("Notes") }}</q-item-label>
            </q-item-section>
            <q-item-section class="fg-inherit" side>
              <div class="row no-wrap q-gutter-x-sm">
                <q-btn
                  @click.stop="toggleSettings"
                  icon="settings"
                  :color="showSettings ? 'primary' : ''"
                  dense
                  round
                  flat
                />
                <NotesDeleteButton />
              </div>
            </q-item-section>
          </template>

          <recess>
            <smooth-reflow height-only class="bg-panel-opaque">
              <template v-if="showSettings">
                <NotesSettings />
                <q-separator />
              </template>
            </smooth-reflow>
          </recess>

          <recess>
            <NoteItem
              v-for="plyID in currentPlyIDs"
              :class="{
                'q-pt-md': plyID < 0,
              }"
              :key="plyID"
              :ref="'note-' + plyID"
              :plyID="plyID"
              :notes="currentLog[plyID]"
              @edit="edit"
              @remove="remove"
            />
            <q-item
              v-if="!currentPlyIDs.length"
              class="flex-center text-center"
              :class="textClass"
            >
              {{ $t("No notes for this position") }}
            </q-item>

            <q-separator />
            <NoteInput
              ref="noteInput"
              @added="onNoteAdded"
              @edited="onNoteEdited"
            />
          </recess>
        </q-expansion-item>

        <q-separator :dark="$store.state.ui.theme.panelDark" />

        <SavedResults v-if="$store.state.analysis" />
      </q-scroll-area>
    </component>
  </div>
</template>

<script>
import NoteItem from "./NoteItem";
import NoteInput from "./NoteInput";
import NotesDeleteButton from "./NotesDeleteButton";
import NotesSettings from "./NotesSettings";
import SavedResults from "./SavedResults";

export default {
  name: "Notes",
  components: {
    NoteItem,
    NoteInput,
    NotesDeleteButton,
    NotesSettings,
    SavedResults,
  },
  props: {
    notesOnly: Boolean,
    recess: Boolean,
  },
  data() {
    return {
      sections: {
        positionNotes: this.$store.state.ui.analysisSections.positionNotes,
      },
      showSettings: false,
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
    currentLog() {
      // Get only notes for the current position, filtering out analysis notes
      // Each note gets an _originalIndex property to map back to the full array
      const plyID = this.positionPlyID;
      const allNotes = this.game.comments.notes;
      const filtered = {};
      if (plyID in allNotes) {
        const filteredNotes = [];
        allNotes[plyID].forEach((note, originalIndex) => {
          if (
            note.evaluation === null &&
            note.pv === null &&
            note.pvAfter === null &&
            note.clock1 === null &&
            note.clock2 === null
          ) {
            filteredNotes.push(
              Object.freeze({ ...note, _originalIndex: originalIndex })
            );
          }
        });
        if (filteredNotes.length > 0) {
          filtered[plyID] = Object.freeze(filteredNotes);
        }
      }
      return Object.freeze(filtered);
    },
    currentPlyIDs() {
      return Object.freeze(Object.keys(this.currentLog).map((id) => 1 * id));
    },
  },
  methods: {
    toggleSettings() {
      this.showSettings = !this.showSettings;
      if (this.showSettings) {
        this.sections.positionNotes = true;
      }
    },
    edit({ plyID, index }) {
      const filteredNotes = this.currentLog[plyID];
      if (!filteredNotes || !filteredNotes[index]) return;
      const originalIndex = filteredNotes[index]._originalIndex;
      this.$refs.noteInput.startEdit({
        plyID,
        index: originalIndex,
        message: filteredNotes[index].message,
      });
    },
    onNoteAdded() {},
    onNoteEdited() {},
    remove({ plyID, index }) {
      const filteredNotes = this.currentLog[plyID];
      if (!filteredNotes || !filteredNotes[index]) return;
      const originalIndex = filteredNotes[index]._originalIndex;
      this.$store.dispatch("game/REMOVE_NOTE", { plyID, index: originalIndex });
      this.notifyUndo({
        message: this.$t("success.noteRemoved"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
  },
  watch: {
    "sections.positionNotes"(value) {
      const storeValue = this.$store.state.ui.analysisSections;
      if (storeValue.positionNotes !== value) {
        this.$store.dispatch("ui/SET_UI", [
          "analysisSections",
          { ...storeValue, positionNotes: value },
        ]);
      }
    },
    "$store.state.ui.analysisSections.positionNotes"(value) {
      if (this.sections.positionNotes !== value) {
        this.sections.positionNotes = value;
      }
    },
  },
};
</script>

<style lang="scss">
.notes-scroll > .q-scrollarea__thumb {
  z-index: 3;
}
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
