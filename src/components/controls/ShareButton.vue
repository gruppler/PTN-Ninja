<template>
  <q-btn
    icon="share"
    v-bind="$attrs"
    @click="noMenu ? share() : null"
    @click.right.prevent="share()"
    v-shortkey="isTextSelected ? null : hotkeys"
    @shortkey="shortkey"
  >
    <hint>{{ $t("Share") }}</hint>
    <q-menu v-if="!noMenu" transition-show="none" transition-hide="none" square>
      <q-list>
        <template v-for="(item, i) in actions">
          <q-separator v-if="!item.label" :key="i" />
          <q-item
            v-else
            clickable
            @click="
              item.disable || item.children
                ? null
                : item.action && item.action()
            "
            :disable="item.disable"
            :key="item.id"
          >
            <q-item-section class="fg-inherit" side>
              <q-icon :name="item.icon" />
            </q-item-section>
            <q-item-section>{{ item.label }}</q-item-section>
            <template v-if="item.children">
              <q-item-section side>
                <q-icon name="forward" />
              </q-item-section>
              <q-menu
                auto-close
                anchor="top end"
                self="top start"
                transition-show="none"
                transition-hide="none"
                square
              >
                <template v-for="(child, j) in item.children">
                  <q-separator v-if="!child.label" :key="j" />
                  <q-item
                    v-else
                    clickable
                    @click="
                      child.disable ? null : child.action && child.action()
                    "
                    :disable="child.disable"
                    :key="child.id"
                  >
                    <q-item-section side>
                      <q-icon :name="child.icon" />
                    </q-item-section>
                    <q-item-section>{{ child.label }}</q-item-section>
                  </q-item>
                </template>
              </q-menu>
            </template>
          </q-item>
        </template>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script>
import { HOTKEYS } from "../../keymap";
import { useTextSelection } from "@vueuse/core";
const selection = useTextSelection();

export default {
  name: "ShareButton",
  props: {
    "no-menu": Boolean,
  },
  data() {
    return {
      bottomSheet: false,
      hotkeys: HOTKEYS.SHARING,
    };
  },
  computed: {
    isTextSelected() {
      return Boolean(selection.text.value);
    },
    bottomSheetActions() {
      return this.actions.map((action) => {
        if (!action.children) {
          return {
            ...action,
            classes: action.disable ? "text-grey-6 disabled" : undefined,
          };
        }

        return {
          ...action,
          children: action.children.map((child) => ({
            ...child,
            classes: child.disable ? "text-grey-6 disabled" : undefined,
          })),
        };
      });
    },
    actions() {
      const copyActions = [
        {
          id: "url",
          label: this.$t("Full Link"),
          icon: "url",
          action: async () => await this.shareText("url", true),
        },
      ];

      const generateActions = [];

      if (
        !this.$store.state.ui.embed &&
        !this.$store.state.game.config.isOnline
      ) {
        generateActions.push({
          id: "urlShort",
          label: this.$t("Short Link"),
          icon: "url_short",
          action: async () => await this.shareText("urlShort", true),
        });
      }

      if (this.$store.state.game.board.ply) {
        copyActions.push({
          id: "ply",
          label: this.$t("Ply"),
          icon: "ply",
          action: async () => await this.shareText("ply"),
        });
      }

      copyActions.push({
        id: "tps",
        label: this.$t("TPS"),
        icon: "board",
        action: async () => await this.shareText("tps"),
      });

      copyActions.push(
        {
          id: "moves",
          label: this.$t("Moves"),
          icon: "moves",
          action: async () => await this.shareText("moves"),
        },
        {
          id: "ptn",
          label: this.$t("PTN"),
          icon: "text",
          action: async () => await this.shareText("ptn"),
        }
      );

      // if (!this.$store.state.ui.embed) {
      //   generateActions.push({
      //     id: "online",
      //     label: this.$t("Online"),
      //     icon: "online",
      //     action: this.online,
      //   });
      // }

      if (
        !this.$store.state.ui.embed &&
        !this.$store.state.game.config.isOnline
      ) {
        generateActions.push(
          {
            id: "embed",
            label: this.$t("Embed"),
            icon: "embed",
            action: this.embed,
          },
          {
            id: "gif",
            label: "GIF",
            icon: "gif",
            action: this.gif,
          },
          {
            id: "png",
            label: this.$t("Image"),
            icon: "png",
            action: this.png,
          }
        );
      }

      generateActions.push(
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

      const actions = [
        {
          id: "copy",
          label: this.$t("Copy"),
          icon: "copy",
          children: copyActions,
        },
        {
          id: "generate",
          label: this.$t("Generate"),
          icon: "autofix",
          children: generateActions,
        },
      ];

      actions.forEach((option) => {
        option.action = () => {
          this.share(option.children, option.label);
        };
      });

      return actions;
    },
  },
  methods: {
    async shortkey({ srcKey }) {
      switch (srcKey) {
        case "exportImage":
          this.$store.dispatch("game/EXPORT_PNG");
          break;
        case "exportPTN":
          this.shareFile();
          break;
        case "share":
          this.share();
          break;
        case "shareTPS":
          await this.shareText("tps");
          break;
        case "sharePTN":
          await this.shareText("ptn");
          break;
        case "shareURL":
          await this.shareText("url", true);
          break;
      }
    },
    async shareText(type) {
      let output;
      switch (type) {
        case "url":
          output = {
            title: this.$t("Link to Position"),
            text: this.$store.getters["ui/url"](this.$game, {
              origin: true,
              state: true,
            }),
          };
          break;
        case "urlShort":
          output = {
            title: this.$t("Link to Position"),
            text: await this.$store.dispatch("ui/GET_SHORT_URL", {
              game: this.$game,
              options: {
                state: true,
              },
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
            title: this.$t("TPS"),
            text: this.$game.editingTPS || this.$game.board.getTPS(),
          };
          break;
        case "moves":
          output = {
            title: this.$t("Moves"),
            text: this.$game.moveText(this.$store.state.showAllBranches, true),
          };
          break;
        case "ptn":
          output = {
            title: this.$t("PTN"),
            text: this.$game.ptn,
          };
          break;
      }
      if (output && output.text) {
        this.$store.dispatch("ui/SHARE", output);
      }
    },
    shareFile() {
      this.$store.dispatch("ui/EXPORT_PTN");
    },
    embed() {
      this.$router.push({ name: "embed" });
    },
    gif() {
      this.$router.push({ name: "gif" });
    },
    png() {
      this.$router.push({ name: "image" });
    },
    online() {
      this.$router.push({ name: "online" });
    },
    qrCode() {
      this.$router.push({ name: "qr" });
    },
    hideShareBottomSheet() {
      const bottomSheet = this.bottomSheet;
      this.bottomSheet = false;

      if (bottomSheet && typeof bottomSheet.hide === "function") {
        try {
          bottomSheet.hide();
        } catch (error) {
          // ignore
        }
      }
    },
    openShareBottomSheet(actions, label) {
      const bottomSheet = this.$q
        .bottomSheet({
          grid: true,
          class: "non-selectable",
          message: label || this.$t("Share"),
          actions,
        })
        .onOk((item) => {
          if (!item.disable && item.action) {
            item.action();
          }
        })
        .onDismiss(() => {
          if (this.bottomSheet === bottomSheet) {
            this.bottomSheet = false;
          }
        });

      this.bottomSheet = bottomSheet;
    },
    share(actions, label) {
      if (Array.isArray(actions)) {
        this.hideShareBottomSheet();
        this.openShareBottomSheet(actions, label);
      } else if (this.bottomSheet) {
        this.hideShareBottomSheet();
      } else {
        this.openShareBottomSheet(this.bottomSheetActions, this.$t("Share"));
      }
    },
  },
};
</script>
