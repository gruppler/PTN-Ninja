<template>
  <q-btn
    @click.stop
    icon="delete"
    :disable="!hasAnyUserNotes"
    v-bind="$attrs"
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
        <q-item clickable :disable="!hasAnyUserNotes" @click="removeAllNotes">
          <q-item-section avatar>
            <q-icon name="delete_all" />
          </q-item-section>
          <q-item-section>{{ $t("Remove All Notes") }}</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script>
// User notes are the ones without analysis or clock data
const isUserNote = (note) =>
  note.evaluation === null &&
  note.pv === null &&
  note.pvAfter === null &&
  note.clock1 === null &&
  note.clock2 === null;

export default {
  name: "NotesDeleteButton",
  computed: {
    game() {
      return this.$store.state.game;
    },
    positionPlyID() {
      const pos = this.game.position;
      if (!pos.ply || (!pos.ply.index && !pos.plyIsDone)) {
        return -1;
      }
      return pos.plyID;
    },
    hasCurrentPositionNotes() {
      const notes = this.game.comments.notes[this.positionPlyID];
      return Boolean(notes && notes.some(isUserNote));
    },
    hasAnyUserNotes() {
      const allNotes = this.game.comments.notes;
      return Object.keys(allNotes).some((plyID) =>
        allNotes[plyID].some(isUserNote)
      );
    },
  },
  methods: {
    removeCurrentPosition() {
      if (!this.hasCurrentPositionNotes) return;
      this.$store.dispatch(
        "game/REMOVE_POSITION_USER_NOTES",
        this.positionPlyID
      );
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
};
</script>
