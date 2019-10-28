<template>
  <div class="q-gutter-y-md column no-wrap">
    <q-input
      v-model="name"
      name="name`"
      :label="$t('Title')"
      @keyup.enter="save"
      color="accent"
      filled
      dark
    >
      <template v-slot:append>
        <q-btn
          v-show="name !== generatedName"
          @click="name = generatedName"
          icon="refresh"
          dense
          flat
        />
      </template>
    </q-input>

    <div class="row q-gutter-md q-mt-none">
      <q-input
        class="col-grow"
        v-model="tags.size"
        name="size"
        type="number"
        min="3"
        max="8"
        :label="$t('Size')"
        :rules="rules('size')"
        :disable="game && game.plies.length > 0"
        @keyup.enter="save"
        @input="$refs.tps.validate()"
        color="accent"
        hide-bottom-space
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="grid_on" />
        </template>
      </q-input>

      <q-input
        ref="tps"
        v-show="tags.tps || (showAll && (!game || !game.plies.length))"
        class="col-grow"
        v-model="tags.tps"
        name="tps"
        :label="$t('TPS')"
        :rules="rules('tps')"
        :disable="game && game.plies.length > 0"
        @keyup.enter="save"
        color="accent"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        hide-bottom-space
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="apps" />
        </template>
        <template v-slot:append>
          <q-btn
            v-show="$refs.tps && !$refs.tps.disable && !$refs.tps.innerError"
            icon="edit"
            dense
            flat
          />
        </template>
      </q-input>
    </div>

    <div class="row">
      <div class="col">
        <div class="row q-gutter-md q-mb-md">
          <q-input
            class="col-grow"
            v-model="tags.player1"
            name="player1"
            :label="$t('Player1')"
            :rules="rules('player1')"
            @keyup.enter="save"
            color="accent"
            hide-bottom-space
            filled
            dark
          >
            <template v-slot:prepend>
              <q-icon name="person" />
            </template>
          </q-input>

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
            @keyup.enter="save"
            color="accent"
            hide-bottom-space
            filled
            dark
          >
            <template v-slot:prepend>
              <q-icon name="star" />
            </template>
          </q-input>
        </div>

        <div class="row q-gutter-md">
          <q-input
            class="col-grow"
            v-model="tags.player2"
            name="player2"
            :label="$t('Player2')"
            :rules="rules('player2')"
            @keyup.enter="save"
            color="accent"
            hide-bottom-space
            filled
            dark
          >
            <template v-slot:prepend>
              <q-icon name="person_outline" />
            </template>
          </q-input>

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
            @keyup.enter="save"
            color="accent"
            hide-bottom-space
            filled
            dark
          >
            <template v-slot:prepend>
              <q-icon name="star_border" />
            </template>
          </q-input>
        </div>
      </div>
      <q-btn @click="swapPlayers" icon="swap_vert" dense flat />
    </div>

    <div v-show="isVisible('date', 'time')" class="row q-gutter-md q-mt-none">
      <q-input
        class="col-grow"
        v-show="isVisible('date')"
        v-model="tags.date"
        name="date"
        :label="$t('Date')"
        :rules="rules('date')"
        @keyup.enter="save"
        color="accent"
        hide-bottom-space
        readonly
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="event" />
        </template>
        <q-popup-proxy ref="qDateProxy">
          <q-date
            @input="$refs.qDateProxy.hide()"
            v-model="tags.date"
            name="date"
            mask="YYYY.MM.DD"
            color="accent"
            text-color="grey-10"
            today-btn
            dark
          />
        </q-popup-proxy>
      </q-input>

      <q-input
        class="col-grow"
        v-show="isVisible('time')"
        v-model="tags.time"
        name="time"
        :label="$t('Time')"
        :rules="rules('time')"
        @keyup.enter="save"
        color="accent"
        hide-bottom-space
        readonly
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="access_time" />
        </template>
        <q-popup-proxy ref="qTimeProxy">
          <q-time
            @input="$refs.qTimeProxy.hide()"
            v-model="tags.time"
            name="time"
            color="accent"
            text-color="grey-10"
            format24h
            with-seconds
            now-btn
            dark
          />
        </q-popup-proxy>
      </q-input>
    </div>

    <div class="row q-gutter-md q-mt-none">
      <q-input
        class="col-grow"
        v-show="isVisible('clock')"
        v-model="tags.clock"
        name="clock"
        :label="$t('Clock')"
        :rules="rules('clock')"
        @keyup.enter="save"
        color="accent"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        hide-bottom-space
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="timer" />
        </template>
      </q-input>

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
        @keyup.enter="save"
        hide-bottom-space
        color="accent"
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="repeat" />
        </template>
      </q-input>
    </div>

    <div class="row q-gutter-md q-mt-none">
      <q-input
        v-if="game"
        class="col-grow"
        v-show="isVisible('result')"
        v-model="tags.result"
        name="result"
        :label="$t('Result')"
        :rules="rules('result')"
        @keyup.enter="save"
        color="accent"
        autocorrect="off"
        spellcheck="false"
        hide-bottom-space
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="gavel" />
        </template>
      </q-input>

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
        @keyup.enter="save"
        color="accent"
        hide-bottom-space
        filled
        dark
      >
        <template v-slot:prepend>
          <q-icon name="stars" />
        </template>
      </q-input>
    </div>

    <q-input
      v-show="isVisible('site')"
      v-model="tags.site"
      name="site"
      :label="$t('Site')"
      :rules="rules('site')"
      @keyup.enter="save"
      color="accent"
      hide-bottom-space
      filled
      dark
    >
      <template v-slot:prepend>
        <q-icon name="place" />
      </template>
    </q-input>

    <q-input
      v-show="isVisible('event')"
      v-model="tags.event"
      name="event"
      :label="$t('Event')"
      :rules="rules('event')"
      @keyup.enter="save"
      color="accent"
      hide-bottom-space
      filled
      dark
    >
      <template v-slot:prepend>
        <q-icon name="emoji_events" />
      </template>
    </q-input>
  </div>
</template>

<script>
import { formats } from "../PTN/Tag";
import TPS from "../PTN/TPS";
import { generateName } from "../PTN/Game/base";

export default {
  name: "GameInfo",
  props: ["game", "values", "showAll"],
  data() {
    return {
      name: "",
      tags: {
        clock: null,
        date: null,
        event: null,
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
        tps: null
      }
    };
  },
  computed: {
    generatedName() {
      return generateName(this.tags, this.game);
    }
  },
  methods: {
    save() {
      this.name = (this.name || "").trim();
      if (!this.game || this.game.name !== this.name) {
        if (!this.name) {
          this.name = this.generatedName;
        }
        this.name = this.$store.getters.uniqueName(this.name, true);
      }

      this.$emit("save", { name: this.name, tags: { ...this.tags } });
      this.updateTags();
    },
    swapPlayers() {
      [this.tags.player1, this.tags.player2] = [
        this.tags.player2,
        this.tags.player1
      ];
      [this.tags.rating1, this.tags.rating2] = [
        this.tags.rating2,
        this.tags.rating1
      ];
    },
    updateTags() {
      Object.keys(this.tags).forEach(key => {
        this.tags[key] =
          (this.values
            ? this.values[key]
            : this.game
            ? this.game.tag(key)
            : null) || null;
      });
    },
    rules(tag) {
      let rules = [value => !value || formats[tag].test(value)];
      if (tag === "tps") {
        const tags = this.tags;
        rules[0] = tps =>
          !tps ||
          ((tps = TPS.parse(tps)) &&
            !!(tps && tps.isValid && tps.size === 1 * tags.size));
      }
      return rules;
    },
    isVisible() {
      const tags = [...arguments];
      return (
        this.showAll ||
        tags.find(
          tag =>
            !!this.tags[tag] ||
            (document.activeElement && document.activeElement.name === tag)
        )
      );
    },
    init() {
      this.updateTags();
      this.name = this.game ? this.game.name : this.generatedName;
    }
  },
  mounted() {
    this.init();
  }
};
</script>

<style></style>
