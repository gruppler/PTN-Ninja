<template>
  <div class="q-gutter-y-md column no-wrap">
    <!-- Game Name -->
    <q-input v-model="name" name="name" :label="$t('Name')" clearable filled>
      <template v-slot:prepend>
        <q-icon name="file" />
      </template>
      <template v-slot:append>
        <q-icon
          v-show="name !== generatedName"
          @click="name = generatedName"
          name="refresh"
          class="q-field__focusable-action"
        />
      </template>
    </q-input>

    <!-- Date/Time -->
    <div v-show="isVisible('date', 'time')" class="row q-gutter-md q-mt-none">
      <q-input
        class="col-grow"
        v-show="isVisible('date')"
        v-model="tags.date"
        name="date"
        :label="$t('Date') + ' (UTC)'"
        :rules="rules('date')"
        :readonly="game && !game.isLocal"
        hide-bottom-space
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="date" />
        </template>
        <q-popup-proxy
          v-if="!game || game.isLocal"
          v-model="showDatePicker"
          @before-show="proxyDate = tags.date"
          anchor="center middle"
          self="center middle"
          transition-show="none"
          transition-hide="none"
          no-refocus
        >
          <div>
            <q-date
              v-model="proxyDate"
              name="date"
              mask="YYYY.MM.DD"
              :text-color="primaryFG"
            >
              <div class="row items-center justify-end q-gutter-sm">
                <q-btn
                  :label="$t('Clear')"
                  @click="tags.date = null"
                  flat
                  v-close-popup
                />
                <div class="col-grow" />
                <q-btn :label="$t('Cancel')" flat v-close-popup />
                <q-btn
                  :label="$t('OK')"
                  @click="tags.date = proxyDate"
                  flat
                  v-close-popup
                />
              </div>
            </q-date>
          </div>
        </q-popup-proxy>
      </q-input>

      <q-input
        class="col-grow"
        v-show="isVisible('time')"
        v-model="tags.time"
        name="time"
        :label="$t('Time') + ' (UTC)'"
        :rules="rules('time')"
        :readonly="game && !game.isLocal"
        hide-bottom-space
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="time" />
        </template>
        <q-popup-proxy
          v-if="!game || game.isLocal"
          v-model="showTimePicker"
          @before-show="proxyTime = tags.time"
          anchor="center middle"
          self="center middle"
          transition-show="none"
          transition-hide="none"
          no-refocus
        >
          <div>
            <q-time
              v-model="proxyTime"
              name="time"
              :text-color="primaryFG"
              format24h
              with-seconds
            >
              <div class="row items-center justify-end q-gutter-sm">
                <q-btn
                  :label="$t('Clear')"
                  @click="tags.time = null"
                  flat
                  v-close-popup
                />
                <div class="col-grow" />
                <q-btn :label="$t('Cancel')" flat v-close-popup />
                <q-btn
                  :label="$t('OK')"
                  @click="tags.time = proxyTime"
                  flat
                  v-close-popup
                />
              </div>
            </q-time>
          </div>
        </q-popup-proxy>
      </q-input>
      <div v-if="datetime" class="text-caption flex flex-center">
        <template v-if="tags.time">
          <relative-time :value="datetime" text-only invert /> &nbsp;
          (<relative-time :value="datetime" text-only />)
        </template>
        <template v-else>
          <relative-date :value="datetime" text-only invert /> &nbsp;
          (<relative-date :value="datetime" text-only />)
        </template>
      </div>
    </div>

    <div class="row">
      <div class="col">
        <div class="row q-gutter-md q-mb-md">
          <!-- Player 1 Account -->
          <PlayerName
            v-if="game && !game.isLocal && player === 1"
            class="col-grow"
            v-model="tags.player1"
            :player="player"
            :is-private="game.config.isPrivate"
            hide-bottom-space
            hide-hint
          />

          <!-- Player 1 Name -->
          <q-input
            v-else
            class="col-grow"
            v-model="tags.player1"
            name="player1"
            :label="$t('Player1')"
            :rules="rules('player1')"
            :readonly="game && !game.isLocal"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon
                :name="
                  $store.getters['ui/playerIcon'](
                    1,
                    game && game.config.isPrivate
                  )
                "
              />
            </template>
          </q-input>

          <!-- Rating 1 -->
          <q-input
            class="col-grow"
            v-show="isVisible('rating1')"
            v-model="tags.rating1"
            name="rating1"
            type="number"
            min="0"
            max="3000"
            :label="$t('Rating1')"
            :rules="rules('rating1')"
            :readonly="game && !game.isLocal && player !== 1"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="rating1" />
            </template>
          </q-input>
        </div>

        <div class="row q-gutter-md">
          <!-- Player 2 Account -->
          <PlayerName
            v-if="game && !game.isLocal && player === 2"
            class="col-grow"
            v-model="tags.player2"
            :player="player"
            :is-private="game.config.isPrivate"
            hide-bottom-space
            hide-hint
          />

          <!-- Player 2 Name -->
          <q-input
            v-else
            class="col-grow"
            v-model="tags.player2"
            name="player2"
            :label="$t('Player2')"
            :rules="rules('player2')"
            :readonly="game && !game.isLocal"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon
                :name="
                  $store.getters['ui/playerIcon'](
                    2,
                    game && game.config.isPrivate
                  )
                "
              />
            </template>
          </q-input>

          <!-- Rating 2 -->
          <q-input
            class="col-grow"
            v-show="isVisible('rating2')"
            v-model="tags.rating2"
            name="rating2"
            type="number"
            min="0"
            max="3000"
            :label="$t('Rating2')"
            :rules="rules('rating2')"
            :readonly="game && !game.isLocal && player !== 2"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="rating2" />
            </template>
          </q-input>
        </div>
      </div>
      <q-btn
        v-show="!game || game.isLocal"
        @click="swapPlayers"
        icon="swap_vert"
        stretch
        dense
        flat
      />
    </div>

    <div class="row q-gutter-md q-mt-none">
      <!-- Size -->
      <q-select
        class="col-grow"
        v-model="tags.size"
        :label="$t('Size')"
        :options="sizes"
        :readonly="game && game.plies.length > 0"
        @input="$refs.tps.validate()"
        behavior="menu"
        map-options
        emit-value
        filled
      >
        <template v-slot:prepend>
          <q-icon name="size" class="flip-vertical" />
        </template>
      </q-select>

      <!-- TPS -->
      <q-input
        ref="tps"
        v-show="tags.tps || !game || !game.plies.length"
        class="col-grow"
        v-model="tags.tps"
        name="tps"
        :label="$t('TPS')"
        :rules="rules('tps')"
        :readonly="game && game.plies.length > 0"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        hide-bottom-space
        filled
      >
        <template v-slot:prepend>
          <q-icon @click.right.prevent="fillTPS" name="board" />
        </template>
        <template v-slot:append>
          <q-icon
            v-show="$refs.tps && !$refs.tps.readonly && !$refs.tps.hasError"
            @click="editTPS"
            name="edit"
            class="q-field__focusable-action"
            v-close-popup
          />
        </template>
      </q-input>
    </div>

    <div
      v-if="tags.size in pieceCounts"
      v-show="isVisible(...pieceCountTags)"
      class="row"
    >
      <div class="col">
        <div
          v-show="!separatePieceCounts"
          class="row q-gutter-md"
          :class="{ 'q-mb-md': separatePieceCounts }"
        >
          <!-- Flats -->
          <q-input
            class="col-grow"
            v-show="!separatePieceCounts"
            v-model="tags.flats"
            :placeholder="pieceCounts[tags.size].flat"
            name="flats"
            type="number"
            min="0"
            max="99"
            :label="$t('Flats')"
            :rules="rules('flats')"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="flats1" />
            </template>
          </q-input>

          <!-- Caps -->
          <q-input
            class="col-grow"
            v-show="!separatePieceCounts"
            v-model="tags.caps"
            :placeholder="pieceCounts[tags.size].cap"
            name="caps"
            type="number"
            min="0"
            :max="tags.size"
            :label="$t('Caps')"
            :rules="rules('caps')"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="caps1" />
            </template>
          </q-input>
        </div>

        <div
          v-show="separatePieceCounts"
          class="row q-gutter-md"
          :class="{ 'q-mb-md': separatePieceCounts }"
        >
          <!-- Flats 1 -->
          <q-input
            class="col-grow"
            v-model="tags.flats1"
            :placeholder="tags.flats || pieceCounts[tags.size].flat"
            name="flats1"
            type="number"
            min="0"
            max="99"
            :label="$t('Flats1')"
            :rules="rules('flats1')"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="flats1" />
            </template>
          </q-input>

          <!-- Caps 1 -->
          <q-input
            class="col-grow"
            v-model="tags.caps1"
            :placeholder="tags.caps || pieceCounts[tags.size].cap"
            name="caps1"
            type="number"
            min="0"
            :max="tags.size"
            :label="$t('Caps1')"
            :rules="rules('caps1')"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="caps1" />
            </template>
          </q-input>
        </div>

        <div v-show="separatePieceCounts" class="row q-gutter-md">
          <!-- Flats 2 -->
          <q-input
            class="col-grow"
            v-model="tags.flats2"
            :placeholder="tags.flats || pieceCounts[tags.size].flat"
            name="flats2"
            type="number"
            min="0"
            max="99"
            :label="$t('Flats2')"
            :rules="rules('flats2')"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="flats2" />
            </template>
          </q-input>

          <!-- Caps 2 -->
          <q-input
            class="col-grow"
            v-model="tags.caps2"
            :placeholder="tags.caps || pieceCounts[tags.size].cap"
            name="caps2"
            type="number"
            min="0"
            :max="tags.size"
            :label="$t('Caps2')"
            :rules="rules('caps2')"
            hide-bottom-space
            clearable
            filled
          >
            <template v-slot:prepend>
              <q-icon name="caps2" />
            </template>
          </q-input>
        </div>
      </div>
      <q-btn
        @click="separatePieceCounts = !separatePieceCounts"
        stretch
        dense
        flat
      >
        <div v-show="separatePieceCounts" class="column">
          <q-icon :name="$store.getters['ui/playerIcon'](1)" />
          <q-icon :name="$store.getters['ui/playerIcon'](2)" />
        </div>
        <q-icon v-show="!separatePieceCounts" name="players" />
      </q-btn>
    </div>

    <div
      v-show="isVisible('komi', 'opening')"
      class="row q-gutter-md q-mt-none"
    >
      <!-- Komi -->
      <q-input
        class="col-grow"
        v-show="isVisible('komi')"
        v-model="tags.komi"
        name="komi"
        type="number"
        min="-20.5"
        max="20.5"
        step="0.5"
        :label="$t('Komi')"
        :rules="rules('komi')"
        hide-bottom-space
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="komi" />
        </template>
      </q-input>

      <!-- Opening -->
      <q-select
        class="col-grow"
        v-show="isVisible('opening')"
        v-model="tags.opening"
        :options="openings"
        :label="$t('Opening')"
        name="opening"
        map-options
        emit-value
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="opening" />
        </template>
      </q-select>
    </div>

    <div class="row q-gutter-md q-mt-none">
      <!-- Clock -->
      <q-input
        class="col-grow"
        v-show="isVisible('clock')"
        v-model="tags.clock"
        name="clock"
        :label="$t('Clock')"
        :rules="rules('clock')"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        hide-bottom-space
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="clock" />
        </template>
      </q-input>

      <!-- Round -->
      <q-input
        class="col-grow"
        v-show="isVisible('round')"
        v-model="tags.round"
        name="round"
        type="number"
        min="1"
        max="999"
        :label="$t('Round')"
        :rules="rules('round')"
        hide-bottom-space
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="round" />
        </template>
      </q-input>
    </div>

    <div class="row q-gutter-md q-mt-none">
      <!-- Result -->
      <q-select
        v-if="game"
        class="col-grow"
        v-show="isVisible('result')"
        v-model="tags.result"
        name="result"
        :options="results"
        :label="$t('Result')"
        :readonly="game && !game.isLocal"
        autocorrect="off"
        spellcheck="false"
        transition-show="none"
        transition-hide="none"
        hide-bottom-space
        emit-value
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="result" />
        </template>

        <template v-slot:selected>
          <q-item-section avatar>
            <Result :result="result" />
          </q-item-section>
          <q-item-section v-if="result">
            <q-item-label>{{
              $t("result." + result.type, {
                player: result.winner
                  ? tags["player" + result.winner] ||
                    $t("Player" + result.winner)
                  : "",
              })
            }}</q-item-label>
          </q-item-section>
        </template>

        <template v-slot:option="scope">
          <q-item v-bind="scope.itemProps" v-on="scope.itemEvents">
            <template v-if="scope.opt.label">
              <q-item-section avatar>
                <Result :result="scope.opt.label" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{
                  $t("result." + scope.opt.label.type, {
                    player: scope.opt.label.winner
                      ? tags["player" + scope.opt.label.winner] ||
                        $t("Player" + scope.opt.label.winner)
                      : "",
                  })
                }}</q-item-label>
              </q-item-section>
            </template>
            <q-item-section v-else>
              <q-item-label>{{ $t("None") }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>

      <!-- Points -->
      <q-input
        v-if="game"
        v-show="isVisible('points')"
        class="col-grow"
        v-model="tags.points"
        name="points"
        min="0"
        max="999"
        type="number"
        :label="$t('Points')"
        :rules="rules('points')"
        hide-bottom-space
        clearable
        filled
      >
        <template v-slot:prepend>
          <q-icon name="points" />
        </template>
      </q-input>
    </div>

    <!-- Event -->
    <q-input
      v-show="isVisible('event')"
      v-model="tags.event"
      name="event"
      :label="$t('Event')"
      :rules="rules('event')"
      hide-bottom-space
      clearable
      filled
    >
      <template v-slot:prepend>
        <q-icon name="event" />
      </template>
    </q-input>

    <!-- Site -->
    <q-input
      v-show="isVisible('site')"
      v-model="tags.site"
      name="site"
      :label="$t('Site')"
      :rules="rules('site')"
      hide-bottom-space
      clearable
      filled
    >
      <template v-slot:prepend>
        <q-icon name="site" />
      </template>
    </q-input>
  </div>
</template>

<script>
import PlayerName from "../controls/PlayerName";
import Result from "../PTN/Result";

import Tag, { formats } from "../../Game/PTN/Tag";
import TPS from "../../Game/PTN/TPS";
import ResultTag from "../../Game/PTN/Result";
import {
  generateName,
  isDefaultName,
  pieceCounts,
  sample,
} from "../../Game/base";

import { map, throttle } from "lodash";

export default {
  name: "GameInfo",
  components: { Result, PlayerName },
  props: ["game", "values", "showAll"],
  data() {
    const openings = map(
      (
        this.$i18n.messages[this.$i18n.locale] ||
        this.$i18n.messages[this.$i18n.fallbackLocale]
      ).openings,
      (label, value) => ({
        label,
        value,
      })
    );
    return {
      name: "",
      tags: {
        caps: null,
        caps1: null,
        caps2: null,
        flats: null,
        flats1: null,
        flats2: null,
        clock: null,
        date: null,
        event: null,
        komi: null,
        opening: "swap",
        player1: null,
        player2: null,
        points: null,
        rating1: null,
        rating2: null,
        result: null,
        round: null,
        site: null,
        size: null,
        time: null,
        tps: null,
      },
      changes: {},
      hasChanges: false,
      proxyDate: null,
      proxyTime: null,
      showDatePicker: false,
      showTimePicker: false,
      separatePieceCounts: false,
      openings,
      pieceCountTags: ["caps", "flats", "caps1", "flats1", "caps2", "flats2"],
      pieceCounts,
      sizes: [3, 4, 5, 6, 7, 8].map((size) => ({
        label: `${size}x${size}`,
        value: size.toString(),
      })),
      results: ["", "R-0", "0-R", "F-0", "0-F", "1-0", "0-1", "1/2-1/2"].map(
        (value) => ({
          value,
          label: value ? ResultTag.parse(value) : "",
        })
      ),
    };
  },
  computed: {
    primaryFG() {
      return this.$store.state.ui.theme.primaryDark ? "textLight" : "textDark";
    },
    generatedName() {
      return generateName(this.tags, this.game);
    },
    result() {
      const result = this.tags.result
        ? this.results.find((option) => option.value === this.tags.result)
        : false;
      return result ? result.label : "";
    },
    player() {
      const user = this.$store.state.online
        ? this.$store.state.online.user
        : false;
      return user ? this.game.player(user.uid) : 0;
    },
    datetime() {
      const date = Tag.toDate(this.tags.date, this.tags.time);
      return isNaN(date) ? null : date;
    },
  },
  methods: {
    hasErrors() {
      return this.$el.getElementsByClassName("q-field--error").length > 0;
    },
    submit(editTPS = false) {
      if (this.hasErrors()) {
        return false;
      }
      // Trim
      this.name = (this.name || "").trim();
      if (this.tags.player1) this.tags.player1 = this.tags.player1.trim();
      if (this.tags.player2) this.tags.player2 = this.tags.player2.trim();
      if (this.tags.tps) this.tags.tps = this.tags.tps.trim();
      if (this.tags.event) this.tags.event = this.tags.event.trim();
      if (this.tags.site) this.tags.site = this.tags.site.trim();

      // Auto-generate name if necessary
      if (!this.game || this.game.name !== this.name) {
        if (!this.name) {
          this.name = this.generatedName;
        }
        this.name = this.$store.getters["game/uniqueName"](this.name, true);
      }

      if (
        this.game &&
        !this.game.isLocal &&
        this.game.config.isPrivate &&
        [1, 2].includes(this.player)
      ) {
        this.$store.dispatch("ui/SET_UI", [
          "playerName",
          this.tags["player" + this.player],
        ]);
        this.player;
      }

      this.$emit("submit", {
        name: this.name,
        tags: { ...this.tags },
        changes: this.changes,
        editTPS,
      });
      this.updateTags();
    },
    editTPS() {
      if (this.game) {
        this.$store.dispatch("ui/SET_UI", [
          "selectedPiece",
          { color: this.game.firstPlayer, type: "F" },
        ]);
        this.$store.dispatch("ui/SET_UI", [
          "firstMoveNumber",
          this.game.firstMoveNumber,
        ]);
        this.$store.dispatch("game/EDIT_TPS", this.game.board.tps);
      } else {
        this.submit(true);
      }
    },
    fillTPS() {
      if (!this.game || !this.game.plies.length) {
        this.tags = { ...this.tags, ...sample(this.tags) };
        this.name = this.generatedName;
      }
    },
    swapPlayers() {
      [this.tags.player1, this.tags.player2] = [
        this.tags.player2,
        this.tags.player1,
      ];
      [this.tags.rating1, this.tags.rating2] = [
        this.tags.rating2,
        this.tags.rating1,
      ];
    },
    updateTags() {
      Object.keys(this.tags).forEach((key) => {
        this.tags[key] =
          (this.values
            ? this.values[key]
            : this.game
            ? this.game.tag(key)
            : null) || null;
      });
      this.separatePieceCounts =
        this.tags.caps1 !== this.tags.caps2 ||
        this.tags.flats1 !== this.tags.flats2;
    },
    rules(tag) {
      const tags = this.tags;
      const rules = [];
      if (tag === "tps") {
        rules[0] = (tps) =>
          !tps ||
          ((tps = TPS.parse(tps)) &&
            !!(tps && tps.isValid && tps.size === 1 * tags.size));
      } else if (tag.startsWith("caps")) {
        rules[0] = (caps) => !caps || 1 * caps <= 1 * tags.size;
      } else if (tag === "komi") {
        rules[0] = (value) => value >= -20.5 && value <= 20.5;
        rules[1] = (value) => !value || formats[tag].test(value);
      } else {
        rules[0] = (value) => !value || formats[tag].test(value);
      }
      return rules;
    },
    isVisible() {
      const tags = [...arguments];
      return (
        this.showAll ||
        tags.find(
          (tag) =>
            (!!this.tags[tag] &&
              (tag !== "opening" || this.tags.opening !== "swap")) ||
            (document.activeElement && document.activeElement.name === tag)
        )
      );
    },
    init() {
      this.updateTags();
      this.name = this.game ? this.game.name : this.generatedName;
    },
  },
  mounted() {
    this.init();
  },
  watch: {
    value(isVisible) {
      if (isVisible) {
        this.init();
      }
    },
    generatedName(newName) {
      if (isDefaultName(this.name)) {
        this.name = newName;
      }
    },
    name(name) {
      if (this.game) {
        name = (name || "").trim();
        if (this.game.name !== name) {
          this.changes.name = name;
        } else {
          delete this.changes.name;
        }

        const hasChanges = Object.values(this.changes).length > 0;
        if (this.hasChanges !== hasChanges) {
          this.hasChanges = hasChanges;
          this.$emit("hasChanges", hasChanges);
        }
      }
    },
    tags: {
      handler: throttle(function (tags) {
        if (!this.game) {
          this.return;
        }
        const changes = {};
        // Trim
        tags = { ...tags };
        if (tags.player1) tags.player1 = tags.player1.trim();
        if (tags.player2) tags.player2 = tags.player2.trim();
        if (tags.tps) tags.tps = tags.tps.trim();
        if (tags.event) tags.event = tags.event.trim();
        if (tags.site) tags.site = tags.site.trim();
        Object.keys(tags).forEach((key) => {
          const value = tags[key] || null;
          const originalValue = this.game ? this.game.tag(key) || null : null;
          if (!this.game || value !== originalValue) {
            changes[key] = value;
          }
        });
        if (this.game && this.game.name !== this.name) {
          changes.name = this.name;
        }
        const hasChanges = Object.values(changes).length > 0;
        this.changes = changes;
        if (this.hasChanges !== hasChanges) {
          this.hasChanges = hasChanges;
          this.$emit("hasChanges", hasChanges);
        }
      }, 100),
      deep: true,
    },
  },
};
</script>

<style lang="scss">
.q-select .result {
  margin: 0 0 -4px;
  font-size: 0.9em;
}
</style>
