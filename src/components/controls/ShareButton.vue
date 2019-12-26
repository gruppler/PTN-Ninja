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
    <QRCode v-model="showQR" :text="qrText" />
  </q-btn>
</template>

<script>
import QRCode from "../dialogs/QRCode";

export default {
  name: "ShareButton",
  components: { QRCode },
  props: ["game"],
  data() {
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
        icon: "layers",
        action: () => this.copy("ply")
      },
      {
        id: "moves",
        label: this.$t("Copy Moves"),
        icon: "format_list_numbered",
        action: () => this.copy("moves")
      },
      {
        id: "ptn",
        label: this.$t("Copy PTN"),
        icon: "file_copy",
        action: () => this.copy("ptn")
      },
      {}
    ];
    if (!this.$store.state.embed) {
      actions.push({
        id: "online",
        label: this.$t("Online"),
        icon: "public",
        action: this.online
      });
    }
    if (!this.$store.state.embed && this.game.isLocal) {
      actions.push({
        id: "embed",
        label: this.$t("Embed"),
        icon: "code",
        action: this.embed
      });
    }
    actions.push(
      {
        id: "download",
        label: this.$t("Download"),
        icon: "save_alt",
        action: this.download
      },
      {
        id: "qrcode",
        label: this.$t("QR Code"),
        icon: "app:qrcode",
        action: this.qrCode
      }
    );

    return {
      actions,
      bottomSheet: false,
      showQR: false,
      qrText: ""
    };
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
          text = this.game.moveText(this.showAllBranches);
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
    online() {
      this.$emit("online");
    },
    qrCode() {
      this.qrText = this.$store.getters.url(this.game, {
        origin: true,
        state: true
      });
      this.showQR = true;
    },
    share() {
      if (this.bottomSheet) {
        this.bottomSheet.hide();
        this.bottomSheet = false;
      } else {
        this.bottomSheet = this.$q
          .bottomSheet({
            grid: true,
            class: "bg-secondary",
            message: this.$t("Share"),
            actions: this.actions
          })
          .onOk(({ action }) => action())
          .onDismiss(() => (this.bottomSheet = false));
      }
    }
  }
};
</script>
