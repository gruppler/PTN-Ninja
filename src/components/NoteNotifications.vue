<template>
  <Notifications v-if="show" :notifications="notifications" color="accent" />
</template>

<script>
import Notifications from "../components/Notifications";

export default {
  name: "NoteNotifications",
  components: { Notifications },
  props: ["game"],
  computed: {
    show() {
      return (
        (this.$store.state.notifyNotes && !this.$store.state.showText) ||
        this.$store.state.textTab !== "notes"
      );
    },
    notifications() {
      const ply = this.game.state.ply;
      if (!ply) {
        return [];
      }
      let notes = [];
      if (!ply.index && !this.game.state.plyIsDone && "-1" in this.game.notes) {
        notes = notes.concat(this.game.notes["-1"]);
      }
      if (ply.id >= 0 && ply.id in this.game.notes) {
        notes = notes.concat(this.game.notes[ply.id]);
      }
      return notes.map(note => ({
        message: note.message,
        icon: "comment",
        classes: "note"
      }));
    }
  }
};
</script>
