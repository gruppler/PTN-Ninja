<template>
  <q-table
    ref="table"
    class="playtak-games-table"
    :columns="columns"
    :visible-columns="visibleColumns"
    :data="tableRows"
    row-key="id"
    :pagination.sync="pagination"
    :loading="loading"
    hide-bottom
    flat
    dense
  >
    <template v-slot:header-cell="props">
      <q-th
        :props="props"
        :class="{ 'playtak-id-col': props.col.name === 'id' }"
      >
        <span
          :class="[
            'row items-center no-wrap full-width',
            headerContentAlignClass(props.col),
          ]"
        >
          <q-icon
            v-if="props.col.icon"
            :name="props.col.icon"
            size="xs"
            :class="[
              { 'q-mr-xs': showHeaderLabel(props.col) },
              props.col.iconClass || null,
            ]"
          />
          <span v-if="showHeaderLabel(props.col)">
            {{ headerLabel(props.col) }}
          </span>
        </span>

        <tooltip v-if="showHeaderTooltip(props.col)">
          {{ headerTitle(props.col) }}
        </tooltip>
      </q-th>
    </template>

    <template v-slot:body="props">
      <q-tr
        v-if="isLoadMorePlaceholderRow(props.row)"
        :props="props"
        class="playtak-load-more-row"
      >
        <q-td
          v-for="col in props.cols"
          :key="col.name"
          :props="props"
          :class="{ 'playtak-id-col': col.name === 'id' }"
        >
          <template v-if="col.name === 'id'">
            <q-skeleton type="text" width="2.85rem" />
          </template>

          <template v-else-if="col.name === 'players'">
            <div class="column q-gutter-xs">
              <q-skeleton type="text" width="6rem" />
              <q-skeleton type="text" width="5rem" />
            </div>
          </template>

          <template v-else-if="col.name === 'ratings'">
            <div class="column q-gutter-xs items-center">
              <q-skeleton type="text" width="2rem" />
              <q-skeleton type="text" width="2rem" />
            </div>
          </template>

          <template v-else-if="col.name === 'size'">
            <div class="row justify-center">
              <q-skeleton type="text" width="1.5rem" />
            </div>
          </template>

          <template v-else-if="col.name === 'time'">
            <div class="row justify-center">
              <q-skeleton type="text" width="3.6rem" />
            </div>
          </template>

          <template v-else-if="col.name === 'type'">
            <div class="row justify-center">
              <q-skeleton type="circle" size="0.95rem" />
            </div>
          </template>

          <template v-else-if="col.name === 'result'">
            <div class="row justify-center">
              <q-skeleton type="text" width="2.8rem" />
            </div>
          </template>

          <template v-else-if="col.name === 'komi'">
            <div class="row justify-center">
              <q-skeleton type="text" width="0.8rem" />
            </div>
          </template>

          <template v-else-if="col.name === 'date'">
            <q-skeleton type="QChip" width="5.5rem" />
          </template>
        </q-td>
      </q-tr>

      <q-tr
        v-else
        :props="props"
        @click="$emit('select', props.row)"
        class="non-selectable cursor-pointer"
        :class="{ 'text-primary': isSelected(props.row) }"
      >
        <q-td
          v-for="col in props.cols"
          :key="col.name"
          :props="props"
          :class="{ 'playtak-id-col': col.name === 'id' }"
        >
          <template v-if="col.name === 'id'">
            <span class="text-weight-medium">{{
              formatGameID(props.row.id)
            }}</span>
          </template>

          <template v-else-if="col.name === 'players'">
            <div class="column no-wrap players-cell">
              <div class="row items-center no-wrap player-line">
                <q-icon :name="playerIcon(1)" left />
                <span class="ellipsis player-name">{{
                  props.row.player1 || "?"
                }}</span>
              </div>
              <div class="row items-center no-wrap player-line">
                <q-icon :name="playerIcon(2)" left />
                <span class="ellipsis player-name">{{
                  props.row.player2 || "?"
                }}</span>
              </div>
            </div>
          </template>

          <template v-else-if="col.name === 'ratings'">
            <div class="column no-wrap ratings-cell">
              <strong class="rating-line">
                {{ playerRating(props.row, 1) || "-" }}
              </strong>
              <strong class="rating-line">
                {{ playerRating(props.row, 2) || "-" }}
              </strong>
            </div>
          </template>

          <template v-else-if="col.name === 'size'">
            {{ formatSize(props.row.size) }}
          </template>

          <template v-else-if="col.name === 'time'">
            {{
              formatTimeControl(
                props.row.time,
                props.row.increment,
                props.row.extraMove,
                props.row.extraTime,
                props.row.scaleIncrement
              )
            }}
          </template>

          <template v-else-if="col.name === 'type'">
            <q-icon
              v-if="gameTypeIcon(props.row)"
              :name="gameTypeIcon(props.row)"
            >
              <hint>{{ formatGameType(props.row) }}</hint>
            </q-icon>
          </template>

          <template v-else-if="col.name === 'result'">
            <PtnResult v-if="props.row.result" :result="props.row.result" />
            <span v-else>-</span>
          </template>

          <template v-else-if="col.name === 'komi'">
            {{ formatKomi(props.row.komiHalf) }}
          </template>

          <template v-else-if="col.name === 'date'">
            <relative-time
              v-if="toDateOrNull(props.row.date)"
              :value="toDateOrNull(props.row.date)"
              style="margin: 0"
            />
            <span v-else>-</span>
          </template>
        </q-td>
      </q-tr>
    </template>

    <template v-slot:no-data>
      <div
        class="full-width row items-center justify-center q-pa-md"
        :class="error ? 'text-negative' : 'text-grey'"
      >
        {{ error || emptyText }}
      </div>
    </template>
  </q-table>
</template>

<script>
import PtnResult from "../PTN/Result";
import { formatPlaytakClockTag } from "../../store/game/playtak";

export default {
  name: "PlayTakGameTable",
  components: {
    PtnResult,
  },
  props: {
    games: {
      type: Array,
      default: () => [],
    },
    selectedIds: {
      type: Array,
      default: () => [],
    },
    selectedId: {
      type: [String, Number],
      default: null,
    },
    loading: Boolean,
    showDate: Boolean,
    showResult: Boolean,
    showLoadMorePlaceholder: Boolean,
    error: {
      type: String,
      default: "",
    },
    emptyText: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      middleScrollEl: null,
      emittedReachEnd: false,
      placeholderCount: 8,
      placeholderRowHeight: 57,
      resizeObserver: null,
      pagination: {
        rowsPerPage: 0,
        sortBy: null,
        descending: false,
      },
      columns: [
        {
          name: "id",
          label: "ID",
          align: "left",
          field: (game) => this.formatGameID(game.id),
          sortable: false,
        },
        {
          name: "players",
          label: this.$t("Players"),
          title: this.$t("Players"),
          icon: "players",
          align: "left",
          field: (game) => `${game.player1 || "?"} vs ${game.player2 || "?"}`,
          sortable: false,
        },
        {
          name: "ratings",
          label: this.$t("Rating"),
          title: this.$t("Rating"),
          icon: "rating1",
          align: "center",
          field: (game) =>
            `${this.playerRating(game, 1) || "-"}/${
              this.playerRating(game, 2) || "-"
            }`,
          sortable: false,
        },
        {
          name: "size",
          label: this.$t("Size"),
          title: this.$t("Size"),
          icon: "size",
          iconClass: "flip-vertical",
          align: "center",
          field: (game) => this.formatSize(game.size),
          sortable: false,
        },
        {
          name: "time",
          label: this.$t("Time"),
          title: this.$t("Time"),
          icon: "time",
          align: "center",
          field: (game) =>
            this.formatTimeControl(
              game.time,
              game.increment,
              game.extraMove,
              game.extraTime,
              game.scaleIncrement
            ),
          sortable: false,
        },
        {
          name: "type",
          label: this.$t("Type"),
          align: "center",
          field: (game) => this.formatGameType(game),
          sortable: false,
        },
        {
          name: "result",
          label: this.$t("Result"),
          title: this.$t("Result"),
          icon: "result",
          align: "center",
          field: (game) => game.result || "",
          sortable: false,
        },
        {
          name: "komi",
          label: this.$t("Komi"),
          title: this.$t("Komi"),
          icon: "komi",
          align: "center",
          field: (game) => this.formatKomi(game.komiHalf),
          sortable: false,
        },
        {
          name: "date",
          label: this.$t("DateTime"),
          title: this.$t("DateTime"),
          icon: "date_time",
          align: "left",
          field: (game) => this.toDateOrNull(game.date),
          sortable: false,
        },
      ],
    };
  },
  mounted() {
    this.bindMiddleScroll();
    this.bindResizeObserver();
    this.updatePlaceholderCount();
  },
  updated() {
    this.bindMiddleScroll();
    this.bindResizeObserver();
    this.$nextTick(() => {
      this.handleMiddleScroll();
      this.updatePlaceholderCount();
    });
  },
  beforeDestroy() {
    this.unbindMiddleScroll();
    this.unbindResizeObserver();
  },
  computed: {
    tableRows() {
      if (!this.showLoadMorePlaceholder) {
        return this.games;
      }

      const count = Math.max(1, this.placeholderCount);
      return [
        ...this.games,
        ...Array.from({ length: count }, (_, i) => ({
          id: `__load-more-placeholder__${i}`,
          __isLoadMorePlaceholder: true,
        })),
      ];
    },
    visibleColumns() {
      const columns = ["id", "players", "ratings", "size", "type"];

      if (this.showResult) {
        columns.push("result");
      }

      columns.push("komi");

      if (this.showDate && this.$q.screen.gt.xs) {
        columns.push("date");
      }

      if (this.$q.screen.xs) {
        const compactColumns = ["id", "players", "ratings", "size"];
        if (this.showResult) {
          compactColumns.push("result");
        }
        if (this.showDate) {
          compactColumns.push("date");
        }
        return compactColumns;
      }

      if (this.$q.screen.lt.md) {
        return columns.filter((name) => name !== "komi");
      }

      return columns;
    },
  },
  watch: {
    showLoadMorePlaceholder() {
      this.$nextTick(this.updatePlaceholderCount);
    },
    games() {
      this.$nextTick(this.updatePlaceholderCount);
    },
  },
  methods: {
    bindMiddleScroll() {
      const table = this.$refs.table;
      const tableRoot = table && table.$el ? table.$el : table;
      const nextEl =
        tableRoot && typeof tableRoot.querySelector === "function"
          ? tableRoot.querySelector(".q-table__middle")
          : null;

      if (nextEl === this.middleScrollEl) {
        return;
      }

      this.unbindMiddleScroll();
      this.middleScrollEl = nextEl;

      if (this.middleScrollEl) {
        this.middleScrollEl.addEventListener(
          "scroll",
          this.handleMiddleScroll,
          {
            passive: true,
          }
        );
        this.$nextTick(this.handleMiddleScroll);
      }
    },
    unbindMiddleScroll() {
      if (this.middleScrollEl) {
        this.middleScrollEl.removeEventListener(
          "scroll",
          this.handleMiddleScroll
        );
      }
      this.middleScrollEl = null;
      this.emittedReachEnd = false;
    },
    handleMiddleScroll() {
      if (!this.middleScrollEl || !this.showLoadMorePlaceholder) {
        this.emittedReachEnd = false;
        return;
      }

      const placeholderEl = this.middleScrollEl.querySelector(
        ".playtak-load-more-row"
      );
      if (!placeholderEl) {
        this.emittedReachEnd = false;
        return;
      }

      const viewportRect = this.middleScrollEl.getBoundingClientRect();
      const rowRect = placeholderEl.getBoundingClientRect();
      const isVisible =
        rowRect.top < viewportRect.bottom && rowRect.bottom > viewportRect.top;

      if (isVisible) {
        if (!this.emittedReachEnd) {
          this.emittedReachEnd = true;
          this.$emit("reach-end");
        }
        return;
      }

      this.emittedReachEnd = false;
    },
    updatePlaceholderCount() {
      if (!this.showLoadMorePlaceholder) {
        return;
      }
      this.$nextTick(() => {
        const table = this.$refs.table;
        const tableRoot = table && table.$el ? table.$el : table;
        const middle =
          tableRoot && typeof tableRoot.querySelector === "function"
            ? tableRoot.querySelector(".q-table__middle")
            : null;
        if (!middle) return;
        const availableHeight = middle.clientHeight;
        const rowHeight = this.placeholderRowHeight;
        if (!availableHeight || !rowHeight) return;
        const totalRowsNeeded = Math.ceil(availableHeight / rowHeight);
        const needed = Math.max(1, totalRowsNeeded - this.games.length);
        if (needed !== this.placeholderCount) {
          this.placeholderCount = needed;
        }
      });
    },
    bindResizeObserver() {
      const table = this.$refs.table;
      const tableRoot = table && table.$el ? table.$el : table;
      const middle =
        tableRoot && typeof tableRoot.querySelector === "function"
          ? tableRoot.querySelector(".q-table__middle")
          : null;
      if (!middle || this.resizeObserver) return;
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => {
          this.updatePlaceholderCount();
        });
        this.resizeObserver.observe(middle);
      } else {
        window.addEventListener("resize", this.updatePlaceholderCount);
      }
    },
    unbindResizeObserver() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      } else {
        window.removeEventListener("resize", this.updatePlaceholderCount);
      }
    },
    isLoadMorePlaceholderRow(row) {
      return !!(row && row.__isLoadMorePlaceholder);
    },
    headerTitle(col) {
      return String((col && col.title) || "");
    },
    headerLabel(col) {
      return String((col && col.label) || "");
    },
    showHeaderLabel(col) {
      return !!(col && col.label && !col.title);
    },
    showHeaderTooltip(col) {
      const title = this.headerTitle(col);
      return !!(col && col.icon && title);
    },
    headerContentAlignClass(col) {
      const align = String((col && col.align) || "left").toLowerCase();
      if (align === "center") {
        return "justify-center";
      }
      if (align === "right") {
        return "justify-end";
      }
      return "justify-start";
    },
    isSelected(game) {
      if (!game || !game.id) {
        return false;
      }

      const selectedIds = Array.isArray(this.selectedIds)
        ? this.selectedIds
        : [];
      if (selectedIds.length) {
        return selectedIds.some((id) => String(id) === String(game.id));
      }

      return String(game.id) === String(this.selectedId || "");
    },
    formatGameID(id) {
      const value = Number(id) || 0;
      return value > 0 ? String(value) : "-";
    },
    playerIcon(player) {
      return this.$store.getters["ui/playerIcon"](player);
    },
    extractRatingFromPlayerToken(value) {
      const text = String(value || "").trim();
      if (!text) {
        return null;
      }

      const bracketMatch = text.match(/(?:\[(\d+)\]|\((\d+)\))$/);
      const trailingMatch = text.match(/(?:^|\s)(\d{2,4})$/);
      const ratingText =
        (bracketMatch && (bracketMatch[1] || bracketMatch[2])) ||
        (trailingMatch && trailingMatch[1]) ||
        "";

      const rating = parseInt(ratingText, 10);
      if (Number.isFinite(rating) && rating > 0) {
        return Math.round(rating);
      }

      return null;
    },
    playerRating(game, player) {
      if (!game || !player) {
        return null;
      }

      const keys =
        player === 1
          ? [
              "rating1",
              "player1Rating",
              "player1rating",
              "rating_white",
              "player_white_rating",
              "white_rating",
            ]
          : [
              "rating2",
              "player2Rating",
              "player2rating",
              "rating_black",
              "player_black_rating",
              "black_rating",
            ];

      for (const key of keys) {
        const value = game[key];
        const numberValue = parseInt(value, 10);
        if (Number.isFinite(numberValue) && numberValue > 0) {
          return Math.round(numberValue);
        }
      }

      const playerKey = player === 1 ? "player1" : "player2";
      const fallbackFromName = this.extractRatingFromPlayerToken(
        game[playerKey]
      );
      if (fallbackFromName) {
        return fallbackFromName;
      }

      return null;
    },
    formatSize(size) {
      const value = Number(size) || 0;
      return value ? `${value}x${value}` : "-";
    },
    formatTimeControl(
      timeSeconds,
      increment,
      extraMove = 0,
      extraTime = 0,
      scaleIncrement = false
    ) {
      // Use the same formatter as the Clock PTN tag so the value shown in
      // this table matches the value loaded games are tagged with (and
      // displayed in the Game Info dialog).
      return (
        formatPlaytakClockTag({
          time: timeSeconds,
          increment,
          extraMove,
          extraTime,
          scaleIncrement,
        }) || "-"
      );
    },
    isTruthyFlag(value) {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value !== 0;
      }
      return String(value || "") === "1" || String(value || "") === "true";
    },
    formatGameType(game) {
      const code = this.resolveGameTypeCode(game);
      if (code === "T") {
        return this.$t("Tournament");
      }
      if (code === "U") {
        return this.$t("Unrated");
      }
      return this.$t("Normal");
    },
    resolveGameTypeCode(game) {
      const code = String(game && game.type ? game.type : "")
        .trim()
        .toUpperCase();

      if (code === "T" || code === "U" || code === "N") {
        return code;
      }

      if (this.isTruthyFlag(game && game.tournament)) {
        return "T";
      }
      if (this.isTruthyFlag(game && game.unrated)) {
        return "U";
      }

      return "N";
    },
    gameTypeIcon(game) {
      const code = this.resolveGameTypeCode(game);
      if (code === "T") {
        return "event";
      }
      if (code === "U") {
        return "unrated";
      }
      return null;
    },
    toDateOrNull(value) {
      if (!value) {
        return null;
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    },
    formatKomi(komiHalf) {
      const value = Number(komiHalf) || 0;
      if (!value) {
        return "";
      }
      if (value % 2 === 0) {
        return `${value / 2}`;
      }

      const whole = Math.floor(value / 2);
      return whole > 0 ? `${whole}½` : "½";
    },
  },
};
</script>

<style lang="scss">
.playtak-games-table {
  // The Q-Table root already has `column no-wrap` (flex column) from
  // Quasar. Joining the parent flex chain with `flex: 1 1 auto` +
  // `min-height: 0` avoids relying on `height: 100%`, which iOS Safari
  // does not reliably resolve through a `min-height: 0` flex ancestor.
  flex: 1 1 auto;
  min-height: 0;

  .q-table__middle {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    background-color: var(--q-color-ui);
    -webkit-overflow-scrolling: touch;
  }

  td.playtak-id-col,
  th.playtak-id-col {
    position: sticky;
    left: 0;
    background-color: var(--q-color-ui);
    background-clip: padding-box;
  }

  // Being sticky takes the header row and the ID column out of the flow the
  // table's own borders follow, so they draw their own separators. Every one
  // of them is theme-aware: a fixed colour is invisible against half the
  // themes, which is what left the header's rules lost on a dark background
  // and the ID column's underline lost on a light one.
  td.playtak-id-col {
    z-index: 1;
    border-bottom: 1px solid $separator-color;
    box-shadow: 1px 0 0 $separator-color;
    .body--dark & {
      border-bottom-color: $separator-dark-color;
      box-shadow: 1px 0 0 $separator-dark-color;
    }
  }

  thead tr th {
    position: sticky;
    top: 0;
    z-index: 1;
    background-color: var(--q-color-ui);
    // Rules between the column headers, and one line under the row. These
    // came from a per-cell $shadow-1 before, which casts on all four sides
    // — so the rules were a shadow rather than a separator, and no theme
    // made them any lighter.
    border-color: $separator-color;
    border-left-width: 1px;
    box-shadow: 0 1px 0 0 $separator-color;
    &:first-child {
      border-left-width: 0;
    }
    .body--dark & {
      border-color: $separator-dark-color;
      box-shadow: 0 1px 0 0 $separator-dark-color;
    }
  }

  // Above the header rules so they scroll under it, and carrying both its
  // own right edge and the header's underline — one box-shadow property.
  th.playtak-id-col {
    z-index: 2;
    box-shadow: 1px 0 0 $separator-color, 0 1px 0 0 $separator-color;
    .body--dark & {
      box-shadow: 1px 0 0 $separator-dark-color, 0 1px 0 0 $separator-dark-color;
    }
  }

  .text-primary .q-icon {
    color: inherit;
  }

  .playtak-load-more-row td {
    pointer-events: none;
    opacity: 0.7;
    height: 57px;
  }
}
</style>
