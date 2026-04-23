<template>
  <div :class="'text-' + textColor">
    <!-- Include Bots -->
    <q-item tag="label" :class="'text-' + textColor" clickable v-ripple>
      <q-item-section avatar>
        <q-icon :name="dbSettings.includeBotGames ? 'bot_on' : 'bot_off'" />
      </q-item-section>
      <q-item-section>
        <q-item-label>
          {{ $t("analysis.includeBotGames") }}
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="dbSettings.includeBotGames" :dark="dark" />
      </q-item-section>
    </q-item>

    <!-- Player 1 -->
    <q-select
      ref="player1"
      v-model="dbSettings.player1"
      :options="player1Names"
      :loading="!player1Index"
      :label="$t('Player1')"
      behavior="menu"
      transition-show="none"
      transition-hide="none"
      item-aligned
      clearable
      filled
      multiple
      use-input
      @filter="searchPlayer1"
      @input="$refs.player1.updateInputValue('')"
      :dark="dark"
      hide-dropdown-icon
    >
      <template v-slot:prepend>
        <q-icon name="player1" />
      </template>
    </q-select>

    <!-- Player 2 -->
    <q-select
      ref="player2"
      v-model="dbSettings.player2"
      :options="player2Names"
      :loading="!player2Index"
      :label="$t('Player2')"
      behavior="menu"
      transition-show="none"
      transition-hide="none"
      item-aligned
      clearable
      filled
      multiple
      use-input
      @filter="searchPlayer2"
      @input="$refs.player2.updateInputValue('')"
      :dark="dark"
      hide-dropdown-icon
    >
      <template v-slot:prepend>
        <q-icon name="player2" />
      </template>
    </q-select>

    <!-- Minimum Rating -->
    <q-input
      v-model.number="dbSettings.minRating"
      :label="$t('Minimum Rating')"
      type="number"
      :min="dbMinRating"
      max="5000"
      step="10"
      :placeholder="String(dbMinRating)"
      :hint="
        dbMinRating ? $t('analysis.dbMinRating', { rating: dbMinRating }) : ''
      "
      :hide-hint="false"
      :style="dbMinRating ? 'padding-bottom: 1.5em' : ''"
      bottom-slots
      item-aligned
      clearable
      filled
      :dark="dark"
    >
      <template v-slot:prepend>
        <q-icon name="rating1" />
      </template>
    </q-input>

    <!-- Komi -->
    <q-select
      v-model="dbSettings.komi"
      :options="komiOptions"
      :label="$t('Komi')"
      type="number"
      emit-value
      map-options
      behavior="menu"
      transition-show="none"
      transition-hide="none"
      item-aligned
      clearable
      filled
      multiple
      :dark="dark"
    >
      <template v-slot:prepend>
        <q-icon name="komi" />
      </template>
    </q-select>

    <!-- Game type -->
    <q-select
      v-model="dbSettings.tournament"
      :options="tournamentOptions"
      :label="$t('analysis.gameType')"
      emit-value
      map-options
      behavior="menu"
      transition-show="none"
      transition-hide="none"
      item-aligned
      clearable
      filled
      :dark="dark"
    >
      <template v-slot:prepend>
        <q-icon :name="dbSettings.tournament ? 'event' : 'event_outline'" />
      </template>
    </q-select>

    <!-- Min/Max Dates -->
    <DateInput
      :label="$t('analysis.minDate')"
      v-model="dbSettings.minDate"
      :max="dbSettings.maxDate ? new Date(dbSettings.maxDate) : null"
      icon="date_arrow_right"
      item-aligned
      clearable
      filled
      :dark="dark"
    />
    <DateInput
      :label="$t('analysis.maxDate')"
      v-model="dbSettings.maxDate"
      :min="dbSettings.minDate ? new Date(dbSettings.minDate) : null"
      icon="date_arrow_left"
      item-aligned
      clearable
      filled
      :dark="dark"
    />
  </div>
</template>

<script>
import DateInput from "../controls/DateInput";
import Fuse from "fuse.js";
import { OPENING_DB_API } from "../../constants";

const usernamesEndpoint = `${OPENING_DB_API}/players`;

export default {
  name: "OpeningsSettings",
  components: {
    DateInput,
  },
  data() {
    let komiOptions = [];
    for (let value = 0; value <= 4; value += 0.5) {
      komiOptions.push({
        label: value.toString().replace(/0?\.5/, "½"),
        value,
      });
    }

    return {
      player1Index: null,
      player1Names: [],
      player2Index: null,
      player2Names: [],
      komiOptions,
      tournamentOptions: [
        { label: this.$t("analysis.tournamentOptions.exclude"), value: false },
        { label: this.$t("analysis.tournamentOptions.only"), value: true },
      ],
      dbSettings: { ...this.$store.state.analysis.dbSettings },
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.isDark;
    },
    textColor() {
      return this.dark ? "textLight" : "textDark";
    },
    dbMinRating() {
      return this.$store.state.analysis.openingStats.dbMinRating || 0;
    },
  },
  methods: {
    async loadUsernames() {
      if (this.$store.state.ui.offline) {
        return;
      }
      const response = await fetch(usernamesEndpoint);
      const { white, black } = await response.json();
      this.player1Index = new Fuse(white);
      this.player2Index = new Fuse(black);
    },
    searchPlayer1(query, update) {
      update(
        () =>
          (this.player1Names = this.player1Index
            .search(query)
            .map((result) => result.item)),
        (ref) => {
          if (query.trim() !== "" && ref.options.length > 0) {
            ref.setOptionIndex(-1);
            ref.moveOptionSelection(1, true);
          }
        }
      );
    },
    searchPlayer2(query, update) {
      update(
        () =>
          (this.player2Names = this.player2Index
            .search(query)
            .map((result) => result.item)),
        (ref) => {
          if (query.trim() !== "" && ref.options.length > 0) {
            ref.setOptionIndex(-1);
            ref.moveOptionSelection(1, true);
          }
        }
      );
    },
  },
  watch: {
    dbSettings: {
      handler(value) {
        const storeValue = this.$store.state.analysis.dbSettings;
        const changed = Object.keys(value).some(
          (key) =>
            JSON.stringify(value[key]) !== JSON.stringify(storeValue[key])
        );
        if (changed) {
          this.$store.dispatch("analysis/SET", ["dbSettings", { ...value }]);
        }
      },
      deep: true,
    },
    "$store.state.analysis.dbSettings": {
      handler(value) {
        const changed = Object.keys(value).some(
          (key) =>
            JSON.stringify(value[key]) !== JSON.stringify(this.dbSettings[key])
        );
        if (changed) {
          this.dbSettings = { ...value };
        }
      },
      deep: true,
    },
  },
  mounted() {
    this.loadUsernames();
  },
};
</script>
