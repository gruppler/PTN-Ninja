<template>
  <q-btn icon="share" v-bind="$attrs" @click.right.prevent="share">
    <q-menu auto-close square>
      <q-list class="bg-secondary text-white">
        <template v-for="(item, i) in actions">
          <q-separator v-if="!item.label" :key="i" />
          <q-item v-else clickable @click="item.action" :key="i">
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
  props: ["game"],
  data() {
    let actions = [
      {
        label: this.$t("Copy Link"),
        icon: "link",
        id: "link",
        action: () => this.copy("link")
      },
      {
        label: this.$t("Copy Ply"),
        icon: "layers",
        id: "ply",
        action: () => this.copy("ply")
      },
      {
        label: this.$t("Copy Moves"),
        icon: "format_list_numbered",
        id: "moves",
        action: () => this.copy("moves")
      },
      {
        label: this.$t("Copy PTN"),
        icon: "file_copy",
        id: "ptn",
        action: () => this.copy("ptn")
      },
      {},
      {
        label: this.$t("Download"),
        icon: "save_alt",
        id: "download",
        action: this.download
      }
    ];
    if (!this.$store.state.embed) {
      if (this.game.isLocal) {
        actions.push({
          label: this.$t("Embed"),
          icon: "code",
          id: "embed",
          action: this.embed
        });
      }
      actions.push({
        label: this.$t("Online"),
        icon: "public",
        id: "online",
        action: this.online
      });
    }

    return {
      actions,
      bottomSheet: false
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
