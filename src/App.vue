<template>
  <div id="q-app" class="absolute-fit no-scroll">
    <router-view ref="layout" />
  </div>
</template>

<script>
import ICONS from "./icons";
import { postMessage } from "./utilities";
import { isString, omit } from "lodash";

export default {
  name: "App",
  created() {
    if (process.env.DEV) {
      window.app = this;
    }

    // Map icons
    this.$q.iconMapFn = (name) => {
      const icon = ICONS[name];
      if (icon !== undefined) {
        return { icon };
      }
    };

    // Load theme
    this.$store.dispatch("ui/SET_THEME", this.$store.state.ui.themeID);

    // Embed API Listeners
    const handleMessage = ({ data, source }) => {
      if (source === window) {
        return;
      }
      switch (data.action) {
        case "SET_NAME":
          this.$refs.layout.title = data.value;
          break;
        case "PLAY":
          if (this.$refs.layout.$refs.playControls) {
            this.$refs.layout.$refs.playControls.play();
          }
          break;
        case "PAUSE":
          if (this.$refs.layout.$refs.playControls) {
            this.$refs.layout.$refs.playControls.pause();
          }
          break;
        case "PLAY_PAUSE":
          if (this.$refs.layout.$refs.playControls) {
            this.$refs.layout.$refs.playControls.playpause();
          }
          break;
        case "SET_UI":
          if (isString(data.value)) {
            data.value = JSON.parse(data.value);
          }
          Object.keys(data.value).forEach((key) => {
            this.$store.dispatch("ui/SET_UI", [key, data.value[key]]);
          });
          break;
        case "TOGGLE_UI":
        case "SHOW_NAMES":
          this.$refs.layout.showNames = data.value;
          break;
        case "SET_GAME":
        case "SET_CURRENT_PTN":
        case "SELECT_SQUARE":
        case "SELECT_PIECE":
        case "DELETE_PLY":
        case "INSERT_PLY":
        case "INSERT_PLIES":
        case "DELETE_BRANCH":
        case "SET_TARGET":
        case "GO_TO_PLY":
        case "PREV":
        case "NEXT":
        case "FIRST":
        case "LAST":
        case "UNDO":
        case "REDO":
        case "PROMOTE_BRANCH":
        case "MAKE_BRANCH_MAIN":
        case "RENAME_BRANCH":
        case "TOGGLE_EVALUATION":
        case "EDIT_NOTE":
        case "ADD_NOTE":
        case "ADD_NOTES":
        case "REMOVE_NOTE":
        case "APPLY_TRANSFORM":
        case "HIGHLIGHT_SQUARES":
          this.$store.dispatch("game/" + data.action, data.value);
          break;
        case "TRIM_BRANCHES":
        case "TRIM_TO_BOARD":
        case "TRIM_TO_PLY":
        case "CANCEL_MOVE":
          this.$store.dispatch("game/" + data.action);
          break;
        case "NOTIFY":
        case "NOTIFY_ERROR":
        case "NOTIFY_SUCCESS":
        case "NOTIFY_WARNING":
        case "NOTIFY_HINT":
          this.$store.dispatch("ui/" + data.action, data.value);
          break;
        case "ROTATE_180":
        case "ROTATE_LEFT":
        case "ROTATE_RIGHT":
        case "FLIP_HORIZONTAL":
        case "FLIP_VERTICAL":
        case "RESET_TRANSFORM":
          this.$store.dispatch("ui/" + data.action);
          break;
        default:
          if (data.action) {
            throw `Invalid action: "${data.action}"`;
          }
      }
    };
    if (process.env.DEV) {
      window.removeEventListener("message", handleMessage);
    }
    window.addEventListener("message", handleMessage);

    // Watch offline status
    this.$store.dispatch("ui/SET_UI", ["offline", !navigator.onLine]);
    window.addEventListener("online", () =>
      this.$store.dispatch("ui/SET_UI", ["offline", false])
    );
    window.addEventListener("offline", () =>
      this.$store.dispatch("ui/SET_UI", ["offline", true])
    );
  },
  watch: {
    "$store.state.game.position": {
      handler(position) {
        position = {
          ...position,
          move: position.move ? position.move.linenum.number : null,
          ply: position.ply ? position.ply.text : null,
          prevPly: position.prevPly ? position.prevPly.text : null,
          nextPly: position.nextPly ? position.nextPly.text : null,
          result:
            position.ply && position.ply.result
              ? omit(position.ply.result, "roads")
              : null,
        };
        postMessage("GAME_STATE", position);
      },
      deep: true,
    },
  },
};
</script>
