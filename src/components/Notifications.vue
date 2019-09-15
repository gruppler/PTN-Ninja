<script>
export default {
  name: "Notifications",
  props: ["game", "state"],
  data() {
    return {
      closers: []
    };
  },
  methods: {
    show() {
      if (!this.game || !this.game.state.ply) {
        return;
      }
      const ply = this.game.state.ply;
      let plyID = this.game.state.plyID;

      const showNotes = note => {
        this.closers.push(
          this.$q.notify({
            color: "accent",
            message: note.message,
            icon: "comment",
            position: "top-right",
            actions: [{ icon: "close", color: "secondary" }],
            classes: "text-grey-10",
            timeout: 0
          })
        );
      };

      if (this.$store.state.notifyNotes) {
        if (plyID in this.game.notes) {
          this.game.notes[plyID]
            .concat()
            .reverse()
            .forEach(showNotes);
        }

        if (!plyID && "-1" in this.game.notes) {
          this.game.notes["-1"]
            .concat()
            .reverse()
            .forEach(showNotes);
        }
      }

      if (ply && ply.result) {
        let result = ply.result;
        let color = result.winner === 1 ? "grey-10" : "grey-2";
        this.closers.push(
          this.$q.notify({
            color: result.winner === 1 ? "blue-grey-2" : "blue-grey-10",
            message: this.$t("result." + result.type, {
              player: this.game.tags["player" + result.winner].value
            }),
            icon: result.winner === 1 ? "person" : "person_outline",
            position: "top-right",
            actions: [{ icon: "close", color }],
            classes: "text-" + color,
            timeout: 0
          })
        );
      }
    },
    hide() {
      this.closers.forEach(close => close());
      this.closers = [];
    }
  },
  watch: {
    state(newState, oldState) {
      if (oldState.name === newState.name) {
        if (oldState.plyID !== newState.plyID) {
          this.hide();
          this.show();
        }
      } else {
        this.hide();
        this.show();
      }
    }
  },
  created() {
    this.show();
  },
  beforeDestroy() {
    this.hide();
  },
  render() {
    return null;
  }
};
</script>
