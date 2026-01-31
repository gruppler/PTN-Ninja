<template>
  <Notifications
    v-if="show"
    ref="notifications"
    :notifications="notifications"
    color="primary"
  />
</template>

<script>
import Notifications from "../general/Notifications";

export default {
  name: "NoteNotifications",
  components: { Notifications },
  computed: {
    show() {
      // Hide if notifications disabled
      if (!this.$store.state.ui.notifyNotes) {
        return false;
      }
      // Hide if Notes tab is shown in text panel
      if (
        this.$store.state.ui.showText &&
        this.$store.state.ui.textTab === "notes"
      ) {
        return false;
      }
      // Hide if Analysis tab is shown with Position Notes section expanded
      if (
        this.$store.state.ui.showText &&
        this.$store.state.ui.textTab === "analysis" &&
        this.$store.state.ui.analysisSections.positionNotes
      ) {
        return false;
      }
      return true;
    },
    game() {
      return this.$store.state.game;
    },
    notifications() {
      const ply = this.game.position.ply;
      let notes = [];
      if (
        (!ply || !ply.index) &&
        !this.game.position.plyIsDone &&
        "-1" in this.game.comments.notes
      ) {
        notes = notes.concat(this.game.comments.notes["-1"]);
      }
      if (ply && ply.id >= 0 && ply.id in this.game.comments.notes) {
        notes = notes.concat(this.game.comments.notes[ply.id]);
      }
      if (!this.$store.state.ui.notifyAnalysisNotes) {
        notes = notes.filter(
          (note) => note.evaluation === null && note.pv === null
        );
      }
      return notes.map((note) => ({
        message: note.message,
        classes:
          "note" + (this.$store.state.ui.disableText ? "" : " cursor-pointer"),
        color: "primary",
        actions: [],
        textColor: this.$store.state.ui.theme.primaryDark
          ? "textLight"
          : "textDark",
      }));
    },
  },
};
</script>
