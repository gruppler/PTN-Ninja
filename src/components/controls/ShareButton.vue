<template>
  <q-btn icon="share" v-bind="$attrs" @click.right.prevent="share">
    <q-menu auto-close square>
      <q-list class="bg-secondary text-white">
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
    <QRCode v-model="qrDialog" :text="qrText" no-route-dismiss />
  </q-btn>
</template>

<script>
import QRCode from "../dialogs/QRCode";

export default {
  name: "ShareButton",
  components: { QRCode },
  props: ["game", "showQR"],
  data() {
    return {
      bottomSheet: false,
      qrText: "",
      qrDialog: false,
    };
  },
  computed: {
    actions() {
      let actions = [
        {
          id: "url",
          label: this.$t("URL"),
          icon: "url",
          action: () => this.shareText("url"),
        },
      ];

      if (this.game.state.ply) {
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
          label: this.$t("PTN Text"),
          icon: "text",
          action: () => this.shareText("ptn"),
        },
        {}
      );

      if (!this.$store.state.embed && this.game.isLocal) {
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
            title: this.game.name,
            url: this.$store.getters.url(this.game, {
              origin: true,
              state: true,
            }),
          };
          break;
        case "ply":
          output = {
            title: this.game.state.ply.text(),
            text: this.game.state.ply.text(),
          };
          break;
        case "tps":
          output = {
            title: this.game.state.tps,
            text: this.game.state.tps,
          };
          break;
        case "moves":
          output = {
            title: this.$t("Moves") + " – " + this.game.name,
            text: this.game.moveText(this.$store.state.showAllBranches, true),
          };
          break;
        case "ptn":
          output = {
            title: this.$t("PTN") + " – " + this.game.name,
            text: this.game.ptn,
          };
          break;
      }
      this.$store.dispatch("COPY", output);
    },
    shareFile() {
      this.$store.dispatch("SAVE_PTN", this.game);
    },
    embed() {
      this.$emit("embed");
    },
    png() {
      this.$emit("png");
    },
    qrCode() {
      this.qrText = this.$store.getters.url(this.game, {
        origin: true,
        state: true,
      });
      this.qrDialog = true;
    },
    share() {
      if (this.bottomSheet) {
        this.bottomSheet.hide();
        this.bottomSheet = false;
      } else {
        this.bottomSheet = this.$q
          .bottomSheet({
            grid: true,
            class: "bg-secondary non-selectable",
            message: this.$t("Share"),
            actions: this.actions,
          })
          .onOk(({ action }) => action())
          .onDismiss(() => (this.bottomSheet = false));
      }
    },
  },
  watch: {
    qrDialog(isVisible) {
      this.$emit("update:showQR", isVisible);
    },
    showQR(isVisible) {
      this.qrDialog = isVisible;
    },
  },
};
</script>
