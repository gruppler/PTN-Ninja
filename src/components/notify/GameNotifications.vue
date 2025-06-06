<template>
  <Notifications
    ref="notifications"
    v-if="show"
    :notifications="notifications"
  />
</template>

<script>
import Notifications from "../general/Notifications";

export default {
  name: "GameNotifications",
  components: { Notifications },
  computed: {
    show() {
      return this.$store.state.ui.notifyGame;
    },
    game() {
      return this.$store.state.game;
    },
    notifications() {
      const ply = this.game.position.plyIsDone
        ? this.game.position.ply
        : this.game.position.prevPly;
      let alerts = [];
      if (ply) {
        if (ply.result) {
          // Game end
          const result = ply.result;
          const winner = result.winner || ply.player;
          alerts.push({
            message: this.$t("result." + result.type, {
              player:
                this.game.ptn.tags["player" + winner] ||
                this.$t("Player" + winner),
            }),
            player: winner,
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
        classes: "game cursor-pointer",
        color: "player" + alert.player,
        icon: this.$store.getters["ui/playerIcon"](alert.player || "tie"),
        actions: [],
        textColor: this.$store.state.ui.theme[`player${alert.player}Dark`]
          ? "textLight"
          : "textDark",
      }));
    },
  },
};
</script>
