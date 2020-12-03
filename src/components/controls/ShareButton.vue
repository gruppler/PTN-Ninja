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
      qrDialog: false
    };
  },
  computed: {
    actions() {
      let actions = [
        {
          id: "url",
          label: this.$t("URL"),
          icon: "url",
          action: () => this.shareText("url")
        }
      ];

      if (this.game.state.ply) {
        actions.push({
          id: "ply",
          label: this.$t("Ply"),
          icon: "ply",
          action: () => this.shareText("ply")
        });
      }

      actions.push(
        {
          id: "moves",
          label: this.$t("Moves"),
          icon: "moves",
          action: () => this.shareText("moves")
        },
        {
          id: "ptn",
          label: this.$t("PTN"),
          icon: "file",
          action: () => this.shareText("ptn")
        },
        {}
      );

      if (!this.$store.state.embed) {
        actions.push({
          id: "online",
          label: this.$t("Online"),
          icon: "online",
          action: this.online
        });
      }

      if (!this.$store.state.embed && this.game.isLocal) {
        actions.push({
          id: "embed",
          label: this.$t("Embed"),
          icon: "embed",
          action: this.embed
        });
      }

      actions.push({
        id: "download",
        label: this.$t("Download"),
        icon: "download",
        action: this.shareFile
      });

      if (this.game.isLocal) {
        actions.push({
          id: "png",
          label: this.$t("Export PNG"),
          icon: "file_image",
          action: () => this.$store.dispatch("PNG", this.game)
        });
      }

      actions.push({
        id: "qrcode",
        label: this.$t("QR Code"),
        icon: "qrcode",
        action: this.qrCode
      });

      return actions;
    }
  },
  methods: {
    shareText(type) {
      let output;
      switch (type) {
        case "url":
          output = {
            title: this.game.name,
            url: this.game.isLocal
              ? this.$store.getters.url(this.game, {
                  origin: true,
                  state: true
                })
              : this.$store.getters["online/url"](this.game)
          };
          break;
        case "ply":
          output = {
            title: this.game.state.ply.text(),
            text: this.game.state.ply.text()
          };
          break;
        case "moves":
          output = {
            title: this.$t("Moves") + " – " + this.game.name,
            text: this.game.moveText(this.$store.state.showAllBranches, true)
          };
          break;
        case "ptn":
          output = {
            title: this.$t("PTN") + " – " + this.game.name,
            text: this.game.ptn
          };
          break;
      }
      this.$store.dispatch("COPY", output);
    },
    shareFile() {
      this.$store.dispatch("SAVE", this.game);
    },
    embed() {
      this.$emit("embed");
    },
    online() {
      this.$emit("online");
    },
    qrCode() {
      if (this.game.config.id) {
        this.qrText = this.$store.getters["online/url"](this.game);
      } else {
        this.qrText = this.$store.getters.url(this.game, {
          origin: true,
          state: true
        });
      }
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
            actions: this.actions
          })
          .onOk(({ action }) => action())
          .onDismiss(() => (this.bottomSheet = false));
      }
    }
  },
  watch: {
    qrDialog(isVisible) {
      this.$emit("update:showQR", isVisible);
    },
    showQR(isVisible) {
      this.qrDialog = isVisible;
    }
  }
};
</script>
