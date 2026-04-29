<template>
  <large-dialog
    ref="dialog"
    :value="model"
    width="800px"
    content-class="non-selectable playtak-game-dialog"
    @show="init"
    @hide="hide"
    no-backdrop-dismiss
    no-route-dismiss
    v-bind="$attrs"
  >
    <template v-slot:header>
      <q-card-section class="q-pa-sm">
        <q-input
          ref="input"
          v-model="gameID"
          @keyup.enter.capture.prevent="load"
          :label="$t('PlayTak Game ID')"
          :rules="[!gameID?.length || validateGameID]"
          hide-bottom-space
          clearable
          autofocus
          filled
        >
          <template v-slot:append>
            <q-icon
              @click="clipboard"
              name="clipboard"
              class="q-field__focusable-action"
              right
            />
          </template>
        </q-input>
      </q-card-section>

      <q-separator />

      <q-tabs v-model="tab" dense align="justify" active-color="primary">
        <q-tab name="ongoing" :label="$t('Ongoing')" />
        <q-tab name="past" :label="$t('Recent')" />
      </q-tabs>

      <q-separator />
    </template>

    <q-card class="playtak-game-card fit column no-wrap">
      <!--
        Filters live inside the card (not the q-header slot) so the q-header
        stays a constant size. Dynamically resizing the q-header breaks
        `.q-page-container` padding-top updates on iOS Safari when the
        container is forced to `position: absolute` by this dialog's layout.
      -->
      <q-card-section v-if="tab === 'past'" class="q-pa-sm">
        <div class="row items-center no-wrap q-col-gutter-sm">
          <div class="col">
            <q-input
              v-model="pastPlayerFilter"
              debounce="300"
              :label="$t('Player Name')"
              clearable
              hide-bottom-space
              filled
              dense
            >
              <template v-slot:prepend>
                <q-icon name="search" />
              </template>
            </q-input>
          </div>

          <div class="col playtak-type-filter">
            <q-select
              v-model="pastGameTypeFilter"
              :label="$t('Type')"
              :options="pastGameTypeOptions"
              behavior="menu"
              transition-show="none"
              transition-hide="none"
              emit-value
              map-options
              clearable
              hide-bottom-space
              filled
              dense
            />
          </div>
        </div>
      </q-card-section>

      <q-separator v-if="tab === 'past'" />

      <q-card-section class="q-pa-none col column no-wrap">
        <div class="playtak-game-table-area">
          <PlayTakGameTable
            :games="games"
            :selected-ids="selectedGameIDs"
            :loading="tableLoading"
            :show-date="tab === 'past'"
            :show-result="tab === 'past'"
            :show-load-more-placeholder="tab === 'past' && pastGamesHasMore"
            :error="listError"
            :empty-text="$t('No Games')"
            @select="selectGame"
            @reach-end="handleTableReachEnd"
          />
        </div>

        <div
          v-if="listError && games.length"
          class="text-negative q-px-md q-pb-sm"
        >
          {{ listError }}
        </div>
      </q-card-section>
    </q-card>

    <template v-slot:footer>
      <q-card-actions class="row items-center justify-between">
        <q-btn
          @click="openPlayTakGamesPage"
          :label="$tc('PlayTak Game', 0)"
          icon="open_in_new"
          flat
        />

        <div class="row items-center">
          <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
          <q-btn
            :label="$t('OK')"
            :disabled="isLoadDisabled"
            :loading="loading"
            @click="load"
            color="primary"
            :flat="isLoadDisabled"
          />
        </div>
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import PlayTakGameTable from "../components/controls/PlayTakGameTable.vue";
import { PLAYTAK_GAMES_URL } from "../store/game/playtak";

export default {
  name: "PlayTakGame",
  components: {
    PlayTakGameTable,
  },
  props: {
    value: Boolean,
    goBack: Boolean,
  },
  data() {
    return {
      loading: false,
      listLoading: false,
      listError: "",
      tab: "ongoing",
      gameID: "",
      selectedGameIDs: [],
      ongoingGames: [],
      pastGames: [],
      pastGamesPage: 0,
      pastGamesHasMore: true,
      autoRefreshTimer: null,
      pendingPastGamesReload: false,
    };
  },
  computed: {
    model() {
      return this.value;
    },
    games() {
      return this.tab === "ongoing" ? this.ongoingGames : this.pastGames;
    },
    tableLoading() {
      return this.listLoading;
    },
    pastPlayerFilter: {
      get() {
        return String(this.$store.state.ui.playtakPlayerFilter || "");
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["playtakPlayerFilter", value || ""]);
      },
    },
    pastGameTypeFilter: {
      get() {
        return String(this.$store.state.ui.playtakGameTypeFilter || "");
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", [
          "playtakGameTypeFilter",
          String(value || "").trim(),
        ]);
      },
    },
    pastPlayerFilterQuery() {
      return String(this.pastPlayerFilter || "").trim();
    },
    pastGameTypeFilterQuery() {
      const value = String(this.pastGameTypeFilter || "").trim();
      if (value === "Tournament") {
        return "Tournament";
      }
      if (value === "Unrated") {
        return "Unrated";
      }
      if (value === "Normal") {
        return "Normal";
      }

      return "";
    },
    pastGameTypeFilterCode() {
      if (this.pastGameTypeFilterQuery === "Tournament") {
        return "T";
      }
      if (this.pastGameTypeFilterQuery === "Unrated") {
        return "U";
      }
      if (this.pastGameTypeFilterQuery === "Normal") {
        return "N";
      }
      return "";
    },
    pastFiltersQueryKey() {
      return `${this.pastPlayerFilterQuery}|${this.pastGameTypeFilterQuery}`;
    },
    pastGameTypeOptions() {
      return [
        { label: this.$t("Normal"), value: "Normal" },
        { label: this.$t("Unrated"), value: "Unrated" },
        { label: this.$t("Tournament"), value: "Tournament" },
      ];
    },
    isLoadDisabled() {
      const targetCount = this.getLoadTargetIDs().length;
      return this.loading || targetCount === 0;
    },
  },
  watch: {
    tab(value) {
      if (value !== "past") {
        this.pendingPastGamesReload = false;
      }
      if (value === "ongoing") {
        if (!this.listLoading) {
          this.fetchOngoingGames();
        }
      } else if (!this.listLoading) {
        this.$store.dispatch("game/STOP_PLAYTAK_ONGOING_GAMES");
        this.fetchPastGames();
      } else {
        this.$store.dispatch("game/STOP_PLAYTAK_ONGOING_GAMES");
      }
      this.startAutoRefresh();
    },
    pastFiltersQueryKey(value, previousValue) {
      if (value === previousValue) {
        return;
      }

      this.pastGames = [];
      this.pastGamesPage = 0;
      this.pastGamesHasMore = true;

      if (this.tab !== "past") {
        return;
      }

      if (this.listLoading) {
        this.pendingPastGamesReload = true;
        return;
      }

      this.fetchPastGames();
    },
  },
  beforeDestroy() {
    this.stopAutoRefresh();
    this.$store.dispatch("game/STOP_PLAYTAK_ONGOING_GAMES");
  },
  methods: {
    hide() {
      this.stopAutoRefresh();
      this.$store.dispatch("game/STOP_PLAYTAK_ONGOING_GAMES");
      if (this.goBack) {
        this.$router.back();
      }
    },
    close() {
      this.$refs.dialog.hide();
    },
    validateGameID(value) {
      return /^\d+(?:[\s,;]+\d+)*$/.test((value || "").trim());
    },
    parseGameIDs(value) {
      const text = String(value || "").trim();
      if (!text) {
        return [];
      }

      return text
        .split(/[\s,;]+/)
        .map((token) => this.normalizeGameID(token))
        .filter((id) => !!id)
        .filter((id, index, array) => array.indexOf(id) === index);
    },
    formatGameIDs(ids) {
      return (Array.isArray(ids) ? ids : []).join(", ");
    },
    firstFiniteNumber(...values) {
      for (const value of values) {
        if (value === null || value === undefined || value === "") {
          continue;
        }
        const numberValue = Number(value);
        if (Number.isFinite(numberValue)) {
          return numberValue;
        }
      }
      return 0;
    },
    toBooleanFlag(value) {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value !== 0;
      }
      const text = String(value || "")
        .trim()
        .toLowerCase();
      return text === "1" || text === "true" || text === "yes";
    },
    resolvePastGameType(game) {
      const code = String(
        game.type || game.game_type || game.gametype || game.gameType || ""
      )
        .trim()
        .toUpperCase();
      if (code === "T" || code === "U" || code === "N") {
        return code;
      }

      if (
        this.toBooleanFlag(
          game.tournament || game.is_tournament || game.tournament_game
        )
      ) {
        return "T";
      }

      const unrated =
        this.toBooleanFlag(game.unrated || game.is_unrated) ||
        (game.rated !== undefined && !this.toBooleanFlag(game.rated));
      return unrated ? "U" : "N";
    },
    normalizeResultText(value) {
      const text = String(value || "")
        .replace(/½/g, "1/2")
        .trim();
      if (!text) {
        return "";
      }

      return /^([01RF]|1\/2)\s*-\s*([01RF]|1\/2)$/.test(text)
        ? text.replace(/\s/g, "")
        : "";
    },
    resolvePastGameResult(game) {
      const direct = [
        game.result,
        game.result_text,
        game.resultText,
        game.game_result,
        game.ptn_result,
        game.ptnResult,
      ]
        .map((value) => this.normalizeResultText(value))
        .find((value) => !!value);
      if (direct) {
        return direct;
      }

      const winner = Number(game.winner || game.winner_id || game.winnerId);
      if (winner === 1) {
        return "1-0";
      }
      if (winner === 2) {
        return "0-1";
      }
      if (
        this.toBooleanFlag(game.draw || game.is_draw || game.tied) ||
        String(game.winner || "").toLowerCase() === "draw"
      ) {
        return "1/2-1/2";
      }

      return "";
    },
    isPastGameOngoing(game, resolvedResult = "") {
      if (resolvedResult === "0-0") {
        return true;
      }

      const flags = [
        game.ongoing,
        game.is_ongoing,
        game.isOngoing,
        game.game_ongoing,
        game.gameOngoing,
      ];
      if (flags.some((value) => this.toBooleanFlag(value))) {
        return true;
      }

      const hasEndedFlags = [game.has_ended, game.hasEnded, game.ended];
      if (
        hasEndedFlags.some((value) =>
          value !== undefined ? !this.toBooleanFlag(value) : false
        )
      ) {
        return true;
      }

      return false;
    },
    normalizePastGames(items) {
      return (Array.isArray(items) ? items : [])
        .map((game) => {
          const result = this.resolvePastGameResult(game);
          if (this.isPastGameOngoing(game, result)) {
            return null;
          }

          return {
            id: Number(game.id) || 0,
            player1: game.player_white,
            player2: game.player_black,
            size: Number(game.size) || 0,
            time: Number(game.timertime) || 0,
            increment: Number(game.timerinc) || 0,
            komiHalf: Number(game.komi) || 0,
            rating1: this.firstFiniteNumber(
              game.rating1,
              game.player1rating,
              game.player_white_rating,
              game.rating_white,
              game.white_rating,
              game.white && game.white.rating
            ),
            rating2: this.firstFiniteNumber(
              game.rating2,
              game.player2rating,
              game.player_black_rating,
              game.rating_black,
              game.black_rating,
              game.black && game.black.rating
            ),
            extraMove: this.firstFiniteNumber(
              game.timeraddmove,
              game.timer_add_move,
              game.extra_move,
              game.extraMove,
              game.extraat
            ),
            extraTime: this.firstFiniteNumber(
              game.timeradd,
              game.timer_add,
              game.extra_time,
              game.extraTime,
              game.extratime
            ),
            tournament: this.toBooleanFlag(
              game.tournament || game.is_tournament || game.tournament_game
            ),
            unrated:
              this.toBooleanFlag(game.unrated || game.is_unrated) ||
              (game.rated !== undefined && !this.toBooleanFlag(game.rated)),
            type: this.resolvePastGameType(game),
            result,
            date: game.date || null,
          };
        })
        .filter((game) => !!game);
    },
    normalizeGameID(value) {
      const text = String(value || "").trim();
      if (!/^\d+$/.test(text)) {
        return "";
      }
      return String(Number(text));
    },
    selectedIDsInTableOrder(selectedIDs = this.selectedGameIDs) {
      const selectedSet = new Set(
        (Array.isArray(selectedIDs) ? selectedIDs : []).map((id) => String(id))
      );
      return this.games
        .map((game) => this.normalizeGameID(game && game.id))
        .filter((id) => !!id && selectedSet.has(id));
    },
    syncInputFromSelection() {
      const orderedIDs = this.selectedIDsInTableOrder();
      this.selectedGameIDs = orderedIDs;
      this.gameID = this.formatGameIDs(orderedIDs);
    },
    getLoadTargetIDs() {
      const inputIDs = this.parseGameIDs(this.gameID);
      if (inputIDs.length) {
        const inputSet = new Set(inputIDs);
        const listedInputIDs = this.games
          .map((game) => this.normalizeGameID(game && game.id))
          .filter((id) => !!id && inputSet.has(id));
        const listedSet = new Set(listedInputIDs);
        const extras = inputIDs.filter((id) => !listedSet.has(id));
        return [...listedInputIDs, ...extras];
      }

      return [];
    },
    selectGame(game) {
      const id = this.normalizeGameID(game && game.id);
      if (!id) {
        return;
      }

      const index = this.selectedGameIDs.findIndex(
        (selectedID) => String(selectedID) === id
      );
      if (index >= 0) {
        this.selectedGameIDs.splice(index, 1);
      } else {
        this.selectedGameIDs.push(id);
      }

      this.syncInputFromSelection();
    },
    openPlayTakGamesPage() {
      window.open(PLAYTAK_GAMES_URL, "_blank", "noopener");
    },
    handleTableReachEnd() {
      if (this.tab !== "past") {
        return;
      }

      if (this.listLoading || !this.pastGamesHasMore) {
        return;
      }

      this.fetchPastGames({ append: true });
    },
    stopAutoRefresh() {
      if (this.autoRefreshTimer) {
        clearTimeout(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
    },
    scheduleAutoRefresh(delayMs) {
      this.stopAutoRefresh();
      this.autoRefreshTimer = setTimeout(() => {
        this.refreshCurrentTabInBackground();
      }, delayMs);
    },
    startAutoRefresh() {
      this.scheduleAutoRefresh(this.tab === "ongoing" ? 6000 : 15000);
    },
    async refreshCurrentTabInBackground() {
      if (!this.model) {
        this.stopAutoRefresh();
        return;
      }

      if (!this.listLoading && !this.loading) {
        if (this.tab === "ongoing") {
          await this.fetchOngoingGames({ silent: true });
        } else if (this.pastGamesPage <= 1) {
          await this.fetchPastGames({ silent: true });
        }
      }

      this.startAutoRefresh();
    },
    async fetchOngoingGames({ silent = false } = {}) {
      if (!silent) {
        this.listLoading = true;
      }
      this.listError = "";
      try {
        const games = await this.$store.dispatch(
          "game/FETCH_PLAYTAK_ONGOING_GAMES"
        );
        this.ongoingGames = Array.isArray(games) ? games : [];
      } catch (error) {
        this.listError = String(error && error.message ? error.message : error);
      } finally {
        if (!silent) {
          this.listLoading = false;
        }

        if (this.pendingPastGamesReload && this.tab === "past") {
          this.pendingPastGamesReload = false;
          this.fetchPastGames();
        }
      }
    },
    async fetchPastGames({ silent = false, append = false } = {}) {
      if (append && (!this.pastGamesHasMore || this.listLoading)) {
        return;
      }

      if (!silent) {
        this.listLoading = true;
      }
      this.listError = "";

      const limit = 20;
      const nextPage = append ? this.pastGamesPage + 1 : 0;

      try {
        const data = await this.$store.dispatch(
          "game/FETCH_PLAYTAK_PAST_GAMES",
          {
            page: nextPage,
            limit,
            player: this.pastPlayerFilterQuery,
            gameType: this.pastGameTypeFilterQuery,
          }
        );
        let rawItems = [];
        if (Array.isArray(data)) {
          rawItems = data;
        } else if (Array.isArray(data && data.items)) {
          rawItems = data.items;
        } else if (Array.isArray(data && data.games)) {
          rawItems = data.games;
        }
        const normalizedItems = this.normalizePastGames(rawItems).sort(
          (a, b) => b.id - a.id
        );
        const rawCount = rawItems.length;
        const items = this.pastGameTypeFilterQuery
          ? normalizedItems.filter(
              (game) =>
                String(game.type || "").toUpperCase() ===
                this.pastGameTypeFilterCode
            )
          : normalizedItems;

        if (append) {
          const existing = new Set(
            this.pastGames.map((game) => Number(game.id))
          );
          const toAdd = items.filter((game) => !existing.has(Number(game.id)));
          this.pastGames = [...this.pastGames, ...toAdd].sort(
            (a, b) => b.id - a.id
          );
        } else {
          this.pastGames = items;
        }

        if (append) {
          if (rawCount > 0) {
            this.pastGamesPage = nextPage;
          }
        } else {
          this.pastGamesPage = rawCount > 0 ? 0 : -1;
        }
        this.pastGamesHasMore = rawCount >= limit;
      } catch (error) {
        this.listError = String(error && error.message ? error.message : error);
      } finally {
        if (!silent) {
          this.listLoading = false;
        }

        if (this.pendingPastGamesReload && this.tab === "past") {
          this.pendingPastGamesReload = false;
          this.fetchPastGames();
        }
      }
    },
    async clipboard() {
      try {
        this.gameID = await this.$store.dispatch("ui/PASTE");
        const parsedIDs = this.parseGameIDs(this.gameID);
        this.selectedGameIDs = parsedIDs;
        this.gameID = this.formatGameIDs(parsedIDs);
      } catch (error) {
        console.error(error);
      }
    },
    buildMetaForIDs(ids) {
      // Capture the fields shown in the ongoing/past table (players, size,
      // komi, flats, caps, ratings, and time-control) so ADD_PLAYTAK_GAMES
      // can build a placeholder Game for ongoing IDs that the history API
      // can't return (they're still ongoing) and encode the Clock tag. Only
      // entries for IDs the user actually selected are returned.
      const meta = {};
      if (!Array.isArray(ids) || !ids.length) {
        return meta;
      }
      const idSet = new Set(ids.map((id) => String(id)));
      const sources = [this.ongoingGames, this.pastGames];
      for (const list of sources) {
        if (!Array.isArray(list)) continue;
        for (const game of list) {
          if (!game) continue;
          const id = String(this.normalizeGameID(game.id));
          if (!id || !idSet.has(id) || meta[id]) continue;
          meta[id] = {
            player1: String(game.player1 || ""),
            player2: String(game.player2 || ""),
            size: Number(game.size) || 0,
            komiHalf: Number(game.komiHalf) || 0,
            flats: Number(game.flats) || 0,
            caps: Number(game.caps) || 0,
            rating1: Number(game.rating1) || 0,
            rating2: Number(game.rating2) || 0,
            time: Number(game.time) || 0,
            increment: Number(game.increment) || 0,
            extraMove: Number(game.extraMove) || 0,
            extraTime: Number(game.extraTime) || 0,
          };
        }
      }
      return meta;
    },
    async load() {
      const ids = this.getLoadTargetIDs();
      if (!ids.length) {
        return;
      }

      this.loading = true;
      try {
        const loadedCount = await this.$store.dispatch(
          "game/ADD_PLAYTAK_GAMES",
          {
            ids,
            ongoing: this.tab === "ongoing",
            meta: this.buildMetaForIDs(ids),
          }
        );

        if (loadedCount > 0) {
          this.$emit("submit");
          this.close();
        }
      } finally {
        this.loading = false;
      }
    },
    async init() {
      this.tab = "ongoing";
      this.gameID = "";
      this.selectedGameIDs = [];
      this.pendingPastGamesReload = false;
      try {
        const text = await this.$store.dispatch("ui/PASTE");
        if (this.validateGameID(text)) {
          const parsedIDs = this.parseGameIDs(text);
          this.selectedGameIDs = parsedIDs;
          this.gameID = this.formatGameIDs(parsedIDs);
        }
      } catch (error) {
        console.error(error);
      }

      this.fetchOngoingGames();
      this.startAutoRefresh();
    },
  },
};
</script>

<style lang="scss">
.playtak-game-dialog {
  .q-layout {
    > .absolute-full > .scroll {
      height: 100%;
      overflow: hidden;
    }

    &,
    .q-page-container {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
    }
  }

  .q-page-container {
    display: flex;
    overflow: hidden !important;
  }
}

.playtak-game-card {
  flex: 1 1 auto;
  min-height: 0;
}

.playtak-game-table-area {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  // Continue the flex chain so the child table can size via flex
  // rather than `height: 100%`, which iOS Safari fails to resolve
  // inside a `min-height: 0` flex child.
  display: flex;
  flex-direction: column;
}

.playtak-type-filter {
  min-width: 10rem;
}
</style>
