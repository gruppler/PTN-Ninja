<template>
  <Notifications v-if="show" :notifications="notifications" />
</template>

<script>
import Notifications from "../general/Notifications";

export default {
  name: "GameNotifications",
  components: { Notifications },
  props: ["game"],
  computed: {
    show() {
      return this.$store.state.ui.notifyGame;
    },
    notifications() {
      const ply = this.game.state.plyIsDone
        ? this.game.state.ply
        : this.game.state.prevPly;
      let alerts = [];
      if (ply) {
        if (ply.result) {
          // Game end
          const result = ply.result;
          alerts.push({
            message: this.$t("result." + result.type, {
              player: this.game.tag(
                "player" + result.winner,
                this.$t(result.winner === 1 ? "White" : "Black")
              ),
            }),
            player: result.winner,
          });
        }
        if (ply.evaluation && (ply.evaluation.tak || ply.evaluation.tinue)) {
          // Tak or Tinue
          alerts.push({
            message:
              this.$t(ply.evaluation.tinue ? "Tinue" : "Tak") +
              ply.evaluation.text.replace(/[^?!]/g, ""),
            player: ply.player,
          });
        }
      }
      return alerts.map((alert) => ({
        message: alert.message,
        color: "player" + alert.player,
        icon: this.$store.getters["ui/playerIcon"](alert.player || "tie"),
        textColor: this.$store.state.ui.theme[`player${alert.player}Dark`]
          ? "textLight"
          : "textDark",
      }));
    },
  },
};
</script>
