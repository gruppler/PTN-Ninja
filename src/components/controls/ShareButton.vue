<template>
  <q-btn
    icon="share"
    v-bind="$attrs"
    @click="noMenu ? share() : null"
    @click.right.prevent="share"
  >
    <hint>{{ $t("Share") }}</hint>
    <q-menu
      v-if="!noMenu"
      transition-show="none"
      transition-hide="none"
      auto-close
      square
    >
      <q-list>
        <template v-for="(item, i) in actions">
          <q-separator v-if="!item.label" :key="i" />
          <q-item v-else clickable @click="item.action" :key="item.id">
            <q-item-section side>
              <q-icon :name="item.icon" />
            </q-item-section>
            <q-item-section>{{ item.label }}</q-item-section>
          </q-item>
        </template>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script>
export default {
  name: "ShareButton",
  props: {
    "no-menu": Boolean,
  },
  data() {
    return {
      bottomSheet: false,
    };
  },
  computed: {
    actions() {
      let actions = [
        {
          id: "urlCurrent",
          label: this.$t("Link to Game"),
          icon: "url",
          action: () => this.shareText("url"),
        },
        {
          id: "urlStart",
          label: this.$t("Link to Position"),
          icon: "url",
          action: () => this.shareText("url", true),
        },
      ];

      if (this.$game.board.ply) {
        actions.push({
          id: "ply",
          label: this.$t("Ply"),
          icon: "ply",
          action: () => this.shareText("ply"),
        });
      }

      actions.push({
        id: "tps",
        label: this.$t("TPS"),
        icon: "board",
        action: () => this.shareText("tps"),
      });

      actions.push(
        {
          id: "moves",
          label: this.$t("Moves"),
          icon: "moves",
          action: () => this.shareText("moves"),
        },
        {
          id: "ptn",
          label: this.$t("PTN"),
          icon: "text",
          action: () => this.shareText("ptn"),
        },
        {}
      );

      if (!this.$store.state.embed) {
        actions.push({
          id: "online",
          label: this.$t("Online"),
          icon: "online",
          action: this.online,
        });
      }

      if (
        !this.$store.state.ui.embed &&
        !this.$store.state.game.config.isOnline
      ) {
        actions.push(
          {
            id: "embed",
            label: this.$t("Embed"),
            icon: "embed",
            action: this.embed,
          },
          {
            id: "png",
            label: this.$t("PNG Image"),
            icon: "file_image",
            action: this.png,
          }
        );
      }

      actions.push(
        {
          id: "download",
          label: this.$t("PTN File"),
          icon: "file",
          action: this.shareFile,
        },
        {
          id: "qrcode",
          label: this.$t("QR Code"),
          icon: "qrcode",
          action: this.qrCode,
        }
      );

      return actions;
    },
  },
  methods: {
    shareText(type) {
      let output;
      switch (type) {
        case "url":
          output = {
            title: this.$game.name,
            url: this.$store.getters["ui/url"](this.$game, {
              origin: true,
              state: Boolean(arguments[1]),
            }),
          };
          break;
        case "ply":
          output = {
            title: this.$game.board.ply.toString(),
            text: this.$game.board.ply.toString(),
          };
          break;
        case "tps":
          output = {
            title: this.$game.board.tps,
            text: this.$game.board.tps,
          };
          break;
        case "moves":
          output = {
            title: this.$t("Moves") + " – " + this.$game.name,
            text: this.$game.moveText(this.$store.state.showAllBranches, true),
          };
          break;
        case "ptn":
          output = {
            title: this.$t("PTN") + " – " + this.$game.name,
            text: this.$game.ptn,
          };
          break;
      }
      this.$store.dispatch("ui/COPY", output);
    },
    shareFile() {
      this.$store.dispatch("ui/EXPORT_PTN");
    },
    embed() {
      this.$router.push({ name: "embed" });
    },
    png() {
      this.$router.push({ name: "png" });
    },
    online() {
      this.$router.push({ name: "online" });
    },
    qrCode() {
      this.$router.push({ name: "qr" });
    },
    share() {
      if (this.bottomSheet) {
        this.bottomSheet.hide();
        this.bottomSheet = false;
      } else {
        this.bottomSheet = this.$q
          .bottomSheet({
            grid: true,
            class: "non-selectable",
            message: this.$t("Share"),
            actions: this.actions,
          })
          .onOk(({ action }) => action())
          .onDismiss(() => (this.bottomSheet = false));
      }
    },
  },
};
</script>
