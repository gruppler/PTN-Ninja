import Vue from "vue";
import VueRouter from "vue-router";

import routes from "./routes";

Vue.use(VueRouter);

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation
 */

const router = new VueRouter({
  scrollBehavior: () => ({ x: 0, y: 0 }),
  routes,

  // Leave these as is and change from quasar.conf.js instead!
  // quasar.conf.js -> build -> vueRouterMode
  // quasar.conf.js -> build -> publicPath
  mode: process.env.VUE_ROUTER_MODE,
  base: process.env.VUE_ROUTER_BASE,
});

// A release can replace the lazy chunks that an already-open page still
// references. The host answers those missing files with index.html, so the
// import fails and the page stays blank. Reload once to pick up the new build.
const RELOAD_KEY = "chunkReloadedAt";
const RELOAD_COOLDOWN = 10000;

router.onError((error) => {
  if (
    !/ChunkLoadError|Loading (CSS )?chunk|Failed to fetch dynamically imported module/i.test(
      `${error && error.name} ${error && error.message}`
    )
  ) {
    return;
  }
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
    if (Date.now() - last < RELOAD_COOLDOWN) {
      return;
    }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch (e) {
    return;
  }
  window.location.reload();
});

export default router;
