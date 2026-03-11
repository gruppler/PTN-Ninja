<template>
  <div class="notes column no-wrap">
    <component
      :is="recess ? 'recess' : 'div'"
      class="col-grow relative-position"
    >
      <q-scroll-area id="notes-scroll-area" class="absolute-fit">
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
                <q-btn
                  @click.stop
                  icon="delete"
                  :disable="!hasAnyUserNotes"
                  dense
                  round
                  flat
                >
                  <q-menu auto-close>
                    <q-list>
                      <q-item
                        clickable
                        :disable="!hasCurrentPositionNotes"
                        @click="removeCurrentPosition"
                      >
                        <q-item-section avatar>
                          <q-icon name="delete" />
                        </q-item-section>
                        <q-item-section>{{
                          $t("Remove Current Positions Notes")
                        }}</q-item-section>
                      </q-item>
                      <q-item
                        clickable
                        :disable="!hasAnyUserNotes"
                        @click="removeAllNotes"
                      >
                        <q-item-section avatar>
                          <q-icon name="delete_all" />
                        </q-item-section>
                        <q-item-section>{{
                          $t("Remove All Notes")
                        }}</q-item-section>
                      </q-item>
                    </q-list>
                  </q-menu>
                </q-btn>
              </div>
            </q-item-section>
          </template>

          <recess>
            <smooth-reflow height-only>
              <template v-if="showSettings">
                <!-- Note Notifications -->
                <q-item :class="textClass" tag="label" v-ripple>
                  <q-item-section>
                    <q-item-label>{{ $t("Note Notifications") }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-toggle v-model="notifyNotes" />
                  </q-item-section>
                </q-item>

                <!-- Analysis Note Notifications -->
                <smooth-reflow>
                  <q-item
                    v-if="notifyNotes"
                    :class="textClass"
                    tag="label"
                    v-ripple="notifyNotes"
                  >
                    <q-item-section>
                      <q-item-label>{{
                        $t("Analysis Note Notifications")
                      }}</q-item-label>
                    </q-item-section>
                    <q-item-section side>
                      <q-toggle
                        v-model="notifyAnalysisNotes"
                        :disable="!notifyNotes"
                      />
                    </q-item-section>
                  </q-item>
                </smooth-reflow>

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

        <SavedResults />
      </q-scroll-area>
    </component>
  </div>
</template>

<script>
import NoteItem from "./NoteItem";
import NoteInput from "./NoteInput";
import SavedResults from "./SavedResults";

export default {
  name: "Notes",
  components: { NoteItem, NoteInput, SavedResults },
  props: {
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
            note.pvAfter === null
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
    hasCurrentPositionNotes() {
      return this.currentPlyIDs.length > 0;
    },
    notifyNotes: {
      get() {
        return this.$store.state.ui.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyNotes", value]);
      },
    },
    notifyAnalysisNotes: {
      get() {
        return this.$store.state.ui.notifyAnalysisNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyAnalysisNotes", value]);
      },
    },
    hasAnyUserNotes() {
      const allNotes = this.game.comments.notes;
      for (const plyID in allNotes) {
        if (
          allNotes[plyID].some(
            (note) =>
              note.evaluation === null &&
              note.pv === null &&
              note.pvAfter === null
          )
        ) {
          return true;
        }
      }
      return false;
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
    removeCurrentPosition() {
      if (!this.hasCurrentPositionNotes) return;
      const plyID = this.positionPlyID;
      this.$store.dispatch("game/REMOVE_POSITION_USER_NOTES", plyID);
      this.notifyUndo({
        message: this.$t("success.removedAurrentPositionsNotes"),
        handler: () => {
          this.$store.dispatch("game/UNDO");
        },
      });
    },
    removeAllNotes() {
      if (!this.hasAnyUserNotes) return;
      this.$store.dispatch("game/REMOVE_ALL_USER_NOTES");
      this.notifyUndo({
        icon: "delete_all",
        message: this.$t("success.removedAllNotes"),
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
