import {
  decompressFromBase64,
  decompressFromEncodedURIComponent,
} from "lz-string";
import Vue from "vue";
import { Platform } from "quasar";
import store from "../store";

const routes = [
  {
    name: "game",
    path: "/game/:gameID",
    component: () => import("layouts/Main"),
    props: true,
  },
  {
    name: "auth",
    path: "/auth",
    component: () => import("pages/Auth"),
  },
  {
    name: "local",
    path: "/:ptn([^&]+)?:state(.*)?",
    component: () => {
      return Platform.within.iframe
        ? import("layouts/Embed")
        : import("layouts/Main");
    },
    props(route) {
      let stateRaw = route.params.state
        ? route.params.state.substr(1).split("&")
        : [];
      let state = {};
      let name = "";
      let ptn = route.params.ptn;

      for (let i = 0; i < stateRaw.length; i++) {
        let item = stateRaw[i].split("=");
        if (/^(true|false)$/.test(item[1])) {
          item[1] = eval(item[1]);
        }
        state[item[0]] = item[1];
      }

      if (state.name) {
        name = decompressFromEncodedURIComponent(state.name) || state.name;
        delete state.name;
      }

      if (state.ply) {
        state.plyIsDone = state.ply.endsWith("!");
        state.plyIndex = parseInt(state.ply, 10);
        delete state.ply;
      }

      if (state.targetBranch) {
        state.targetBranch =
          decompressFromEncodedURIComponent(state.targetBranch) ||
          state.targetBranch;
      }

      if (state.theme && !(state.theme in store.getters["ui/themes"])) {
        try {
          state.theme =
            decompressFromEncodedURIComponent(state.theme) || state.theme;
          if (state.theme.startsWith("{")) {
            state.theme = JSON.parse(state.theme);
          }
        } catch (error) {
          console.error("Failed to read theme", state.theme, error);
        }
      }

      if (/^[A-Za-z0-9$+-]+$/.test(ptn)) {
        ptn = decompressFromEncodedURIComponent(ptn);
      }

      return { ptn, name, state };
    },
    children: [
      {
        name: "account",
        path: "/account",
        component: () => import("../dialogs/Account"),
      },
      {
        name: "add",
        path: "/add/:tab?/:online?/:fullscreen?",
        component: () => import("../dialogs/AddGame"),
      },
      {
        name: "close",
        path: "/close",
        component: () => import("../dialogs/CloseGames"),
      },
      {
        name: "download",
        path: "/download",
        component: () => import("../dialogs/DownloadGames"),
      },
      {
        name: "edit",
        path: "/edit",
        component: () => import("../dialogs/EditPTN"),
      },
      {
        name: "embed",
        path: "/embed",
        component: () => import("../dialogs/EmbedConfig"),
      },
      {
        name: "help",
        path: "/help/:section?",
        component: () => import("../dialogs/Help"),
      },
      {
        name: "info-view",
        path: "/info",
        component: () => import("../dialogs/GameInfo"),
      },
      {
        name: "info-edit",
        path: "/info/edit",
        component: () => import("../dialogs/EditGame"),
      },
      {
        name: "join",
        path: "/join",
        component: () => import("../dialogs/JoinGame"),
      },
      {
        name: "login",
        path: "/login/:tab?",
        component: () => import("../dialogs/LogIn"),
      },
      {
        name: "online",
        path: "/online/:qr?",
        component: () => import("../dialogs/ShareOnline"),
      },
      {
        name: "png",
        path: "/png",
        component: () => import("../dialogs/PNGConfig"),
      },
      {
        name: "preferences",
        path: "/preferences",
        component: () => import("../dialogs/Preferences"),
      },
      {
        name: "qr",
        path: "/qr",
        component: () => import("../dialogs/QRCode"),
      },
      {
        name: "rename-branch",
        path: "/rename/:branch",
        props: true,
        component: () => import("../dialogs/RenameBranch"),
      },
      {
        name: "theme",
        path: "/theme",
        component: () => import("../dialogs/ThemeConfig"),
      },
    ],
  },
];

// Always leave this as last one
routes.push({
  path: "*",
  component: () => import("pages/Error404"),
});

export default routes;
