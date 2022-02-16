<template>
  <div id="q-app" class="absolute-fit no-scroll">
    <router-view />
  </div>
</template>

<script>
import ICONS from "./icons";

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
    const handleMessage = ({ data }) => {
      switch (data.action) {
        case "SET_NAME":
          this.title = data.value;
          break;
        case "SET_UI":
          Object.keys(data.value).forEach((key) => {
            this.$store.dispatch("ui/SET_UI", [key, data.value[key]]);
          });
          break;
        case "SHOW_NAMES":
          this.showNames = data.value;
          break;
        case "SET_GAME":
        case "SET_CURRENT_PTN":
        case "SELECT_SQUARE":
        case "SELECT_PIECE":
        case "DELETE_PLY":
        case "DELETE_BRANCH":
        case "SET_TARGET":
        case "PREV":
        case "NEXT":
        case "GO_TO_PLY":
        case "RENAME_BRANCH":
        case "TOGGLE_EVALUATION":
        case "EDIT_NOTE":
        case "ADD_NOTE":
        case "REMOVE_NOTE":
          this.$store.dispatch("game/" + data.action, data.value);
          break;
        case "FIRST":
        case "LAST":
        case "UNDO":
        case "REDO":
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
        case "TOGGLE_UI":
        case "RESET_TRANSFORM":
        case "ROTATE_180":
        case "ROTATE_LEFT":
        case "ROTATE_RIGHT":
        case "FLIP_HORIZONTAL":
        case "FLIP_VERTICAL":
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
  },
};
</script>
