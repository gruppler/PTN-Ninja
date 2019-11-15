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
        state[item[0]] = item[1];
      }

      if (state.name) {
        name = state.name;
        delete state.name;
      }

      if (state.ply) {
        state.plyIsDone = state.ply.endsWith("!");
        state.plyIndex = parseInt(state.ply, 10);
        delete state.ply;
      }

      if (state.branch) {
        state.targetBranch = state.branch;
        delete state.branch;
      }

      if (/^[A-Za-z0-9$+-]+$/.test(ptn)) {
        ptn = decompressFromEncodedURIComponent(ptn);
      } else {
        ptn = decodeURIComponent(ptn);
      }

      Object.keys(state).forEach(key => {
        if (/^(true|false)$/.test(state[key])) {
          state[key] = eval(state[key]);
        }
      });

      return { ptn, name, state };
    },
    children: [
      {
        name: "add",
        path: "/add"
      },
      {
        name: "settings",
        path: "/settings"
      },
      {
        name: "edit",
        path: "/edit"
      },
      {
        name: "embed",
        path: "/embed"
      }
    ]
  }
];

// Always leave this as last one
if (process.env.MODE !== "ssr") {
  routes.push({
    path: "*",
    component: () => import("pages/Error404")
  });
}

export default routes;
