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
          id: "link",
          label: this.$t("Copy Link"),
          icon: "link",
          action: () => this.copy("link")
        },
        {
          id: "ply",
          label: this.$t("Copy Ply"),
          icon: "ply",
          action: () => this.copy("ply")
        },
        {
          id: "moves",
          label: this.$t("Copy Moves"),
          icon: "moves",
          action: () => this.copy("moves")
        },
        {
          id: "ptn",
          label: this.$t("Copy PTN"),
          icon: "copy",
          action: () => this.copy("ptn")
        },
        {}
      ];

      if (!this.$store.state.embed && this.game.isLocal) {
        actions.push({
          id: "embed",
          label: this.$t("Embed"),
          icon: "embed",
          action: this.embed
        });
      }

      actions.push(
        {
          id: "download",
          label: this.$t("Download"),
          icon: "download",
          action: this.download
        },
        {
          id: "qrcode",
          label: this.$t("QR Code"),
          icon: "qrcode",
          action: this.qrCode
        }
      );

      return actions;
    }
  },
  methods: {
    copy(type) {
      let text;
      switch (type) {
        case "link":
          text = this.$store.getters.url(this.game, {
            origin: true,
            state: true
          });
          break;
        case "ply":
          text = this.game.state.ply.text();
          break;
        case "moves":
          text = this.game.moveText(this.$store.state.showAllBranches, true);
          break;
        case "ptn":
          text = this.game.ptn;
          break;
      }
      this.$store.dispatch("COPY", {
        text,
        message: this.$t("Copied")
      });
    },
    download() {
      this.$store.dispatch("SAVE", this.game);
    },
    embed() {
      this.$emit("embed");
    },
    qrCode() {
      this.qrText = this.$store.getters.url(this.game, {
        origin: true,
        state: true
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
