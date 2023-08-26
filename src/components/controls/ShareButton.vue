<template>
  <q-btn
    icon="share"
    v-bind="$attrs"
    @click="noMenu ? share() : null"
    @click.right.prevent="share()"
    v-shortkey="hotkeys"
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
            @click="item.children ? null : item.action()"
            :key="item.id"
          >
            <q-item-section side>
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
                    @click="child.action"
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
    actions() {
      const actions = [];

      const addCopyActions = (actions) => {
        actions.push({
          id: "url",
          label: this.$t("Link"),
          icon: "url",
          action: () => this.shareText("url"),
        });

        if (this.$game.board.ply) {
          actions.push({
            id: "ply",
            label: this.$t("Ply"),
            icon: "ply",
            action: () => this.shareText("ply"),
          });
        }

        actions.push(
          {
            id: "tps",
            label: this.$t("TPS"),
            icon: "board",
            action: () => this.shareText("tps"),
          },
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
          }
        );
      };

      if (this.$store.state.ui.embed) {
        addCopyActions(actions);
      } else {
        actions.push(
          {
            id: "copy",
            label: this.$t("Copy"),
            icon: "copy",
            children: [],
          },
          {}
        );

        addCopyActions(actions[0].children);

        actions.push(
          {
            id: "playOnline",
            label: this.$t("Play Online"),
            icon: "players",
            action: this.playOnline,
          },
          {
            id: "analysisOnline",
            label: this.$t("New Analysis"),
            icon: "analysis",
            action: this.analysisOnline,
          },
          {
            id: "puzzleOnline",
            label: this.$t("New Puzzle"),
            icon: "puzzle",
            action: this.puzzleOnline,
          },
          {}
        );
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

      // Add submenu bottom-sheet actions
      actions.forEach((option) => {
        if (option.children) {
          option.action = () => {
            this.share(option.children, option.label);
          };
        }
      });

      return actions;
    },
  },
  methods: {
    shortkey({ srcKey }) {
      switch (srcKey) {
        case "exportPNG":
          this.$store.dispatch("game/EXPORT_PNG");
          break;
        case "exportPTN":
          this.shareFile();
          break;
        case "share":
          this.share();
          break;
        case "shareTPS":
          this.shareText("tps");
          break;
        case "sharePTN":
          this.shareText("ptn");
          break;
        case "shareURL":
          this.shareText("url", true);
          break;
      }
    },
    shareText(type) {
      let output;
      switch (type) {
        case "url":
          output = {
            title: this.$game.config.isOnline
              ? "URL"
              : this.$t("Link to Position"),
            text: this.$store.getters["ui/url"](this.$game, {
              origin: true,
              state: true,
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
            text: this.$game.board.getTPS(),
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
      this.$store.dispatch("ui/SHARE", output);
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
    playOnline() {
      this.$router.push({ name: "play-online" });
    },
    analysisOnline() {
      this.$router.push({ name: "analysis-online" });
    },
    puzzleOnline() {
      this.$router.push({ name: "puzzle-online" });
    },
    qrCode() {
      this.$router.push({ name: "qr" });
    },
    share(actions, label) {
      if (actions) {
        if (this.bottomSheet) {
          this.bottomSheet.hide();
          this.bottomSheet = this.$q
            .bottomSheet({
              grid: true,
              class: "non-selectable",
              message: label || this.$t("Share"),
              actions,
            })
            .onOk(({ action }) => action())
            .onDismiss(() => (this.bottomSheet = false));
        }
      } else if (this.bottomSheet) {
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
