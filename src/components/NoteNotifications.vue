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
      const plyID = this.game.state.plyID;
      let notes = [];
      if (!plyID && "-1" in this.game.notes) {
        notes = notes.concat(this.game.notes["-1"]);
      }
      if (plyID in this.game.notes) {
        notes = notes.concat(this.game.notes[plyID]);
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
