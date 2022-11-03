<template>
  <small-dialog
    ref="dialog"
    :value="true"
    content-class="non-selectable"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <smooth-reflow class="fit">
        <q-tabs
          v-model="tab"
          active-color="primary"
          indicator-color="primary"
          align="justify"
        >
          <q-tab name="new" :label="$t('New Game')" />
          <q-tab name="load" :label="$t('Load Game')" />
        </q-tabs>
      </smooth-reflow>
    </template>

    <q-card>
      <smooth-reflow>
        <q-tab-panels v-model="tab" keep-alive animated>
          <q-tab-panel name="new" class="q-pa-none">
            <q-card-section class="q-pa-none">
              <GameInfo
                ref="gameInfo"
                class="q-pa-md"
                :values="tags"
                :show-all="showAll"
                @submit="createGame"
              />
            </q-card-section>
          </q-tab-panel>

          <q-tab-panel name="load" class="q-pa-none">
            <q-list separator>
              <!-- Clipboard -->
              <q-item @click="clipboard" clickable v-ripple>
                <q-item-section avatar>
                  <q-icon name="clipboard" />
                </q-item-section>
                <q-item-section>{{ $t("Clipboard") }}</q-item-section>
              </q-item>

              <!-- Files -->
              <q-item
                @click="$store.dispatch('ui/OPEN', close)"
                clickable
                v-ripple
              >
                <q-item-section avatar>
                  <q-icon name="local" />
                </q-item-section>
                <q-item-section>{{ $t("Files") }}</q-item-section>
              </q-item>

              <!-- Online -->
              <q-item :to="{ name: 'load-online' }" replace clickable v-ripple>
                <q-item-section avatar>
                  <q-icon name="online" />
                </q-item-section>
                <q-item-section>{{ $t("Online") }}</q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>
        </q-tab-panels>
      </smooth-reflow>
    </q-card>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <MoreToggle v-show="tab === 'new'" v-model="showAll" />
        <div class="col-grow" />
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="ok"
          :disabled="tab === 'load'"
          color="primary"
          flat
        />
      </q-card-actions>
    </template>

    <EditPTN
      v-model="showPTN"
      :ptn="ptn"
      @submit="clipboardCreate"
      no-route-dismiss
    />
  </small-dialog>
</template>

<script>
import GameInfo from "../components/controls/GameInfo";
import EditPTN from "../dialogs/EditPTN.vue";
import MoreToggle from "../components/controls/MoreToggle.vue";

import Game from "../Game";

export default {
  name: "AddGame",
  components: { GameInfo, EditPTN, MoreToggle },
  data() {
    return {
      tags: {
        player1: this.$store.state.ui.player1,
        player2: this.$store.state.ui.player2,
        size: String(this.$store.state.ui.size),
        komi: Number(this.$store.state.ui.komi),
        site: this.$t("site_name"),
      },
      ptn: "",
      showAll: false,
    };
  },
  computed: {
    tab: {
      get() {
        return this.$route.params.tab || "new";
      },
      set(tab) {
        this.$router.replace({ params: { tab } });
      },
    },
    showPTN: {
      get() {
        return this.$route.params.type === "ptn";
      },
      set(show) {
        if (!show && this.showPTN) {
          this.$router.back();
        } else if (show && !this.showPTN) {
          this.$router.push({ params: { type: show ? "ptn" : null } });
        }
      },
    },
    size: {
      get() {
        return this.$store.state.ui.size;
      },
      set(value) {
        this.tags.size = value;
        this.$store.dispatch("ui/SET_UI", ["size", value || ""]);
      },
    },
    komi: {
      get() {
        return this.$store.state.ui.komi;
      },
      set(value) {
        this.tags.komi = value;
        this.$store.dispatch("ui/SET_UI", ["komi", Number(value) || 0]);
      },
    },
    player1: {
      get() {
        return this.$store.state.ui.player1;
      },
      set(value) {
        this.tags.player1 = value;
        this.$store.dispatch("ui/SET_UI", ["player1", value || ""]);
      },
    },
    player2: {
      get() {
        return this.$store.state.ui.player2;
      },
      set(value) {
        this.tags.player2 = value;
        this.$store.dispatch("ui/SET_UI", ["player2", value || ""]);
      },
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    async clipboard() {
      const ptn = await navigator.clipboard.readText();
      if (!ptn || Game.validate(ptn) !== true) {
        this.ptn = ptn;
        this.showPTN = true;
      } else {
        let game = new Game({ ptn });
        await this.$store.dispatch("game/ADD_GAME", game);
        this.close();
      }
    },
    async clipboardCreate(ptn) {
      let game;
      try {
        game = new Game({ ptn });
      } catch (error) {
        console.error(error);
      }

      game.warnings.forEach((warning) => this.notifyWarning(warning));

      await this.$store.dispatch("game/ADD_GAME", game);
      this.close();
    },
    async createGame({ name, tags, editTPS }) {
      this.player1 = tags.player1;
      this.player2 = tags.player2;
      this.size = tags.size;
      this.komi = tags.komi;

      let game;
      try {
        game = new Game({ name, tags });
      } catch (error) {
        console.error(error);
      }

      game.warnings.forEach((warning) => this.notifyWarning(warning));

      await this.$store.dispatch("game/ADD_GAME", game);

      if (editTPS) {
        this.$store.dispatch("ui/SET_UI", [
          "selectedPiece",
          { color: 1, type: "F" },
        ]);
        this.$store.dispatch("ui/SET_UI", ["firstMoveNumber", 1]);
        this.$store.dispatch("game/EDIT_TPS", "");
      }

      this.close();
    },
    ok() {
      if (this.tab === "new") {
        this.$refs.gameInfo.submit();
      }
    },
  },
};
</script>
