import { decompressFromEncodedURIComponent } from "lz-string";
import { Platform } from "quasar";

const routes = [
  {
    name: "local",
    path: "/:ptn([^&]+)?:state(.*)?",
    component: () => {
      return Platform.within.iframe
        ? import("layouts/Embed")
        : import("layouts/Main");
    },
    props(route) {
      let stateRaw = (route.params.state || "").substr(1).split("&");
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

      if (/^[A-Za-z0-9$+-]+$/.test(ptn)) {
        ptn = decompressFromEncodedURIComponent(ptn);
      }

      return { ptn, name, state };
    },
    children: [
      {
        name: "help",
        path: "/help/:section?",
      },
      {
        name: "add",
        path: "/add/:tab?",
      },
      {
        name: "close",
        path: "/close",
      },
      {
        name: "download",
        path: "/download",
      },
      {
        name: "preferences",
        path: "/preferences",
      },
      {
        name: "info",
        path: "/info",
      },
      {
        name: "edit",
        path: "/edit",
      },
      {
        name: "embed",
        path: "/embed",
      },
      {
        name: "png",
        path: "/png",
      },
      {
        name: "qr",
        path: "/qr",
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
