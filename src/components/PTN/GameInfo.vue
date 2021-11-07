<template>
  <q-list>
    <!-- Name -->
    <q-item>
      <q-item-section avatar>
        <q-icon name="file" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ name }}</q-item-label>
      </q-item-section>
    </q-item>

    <!-- Size -->
    <q-item>
      <q-item-section avatar>
        <q-icon name="size" class="flip-vertical" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ tags.size }}</q-item-label>
      </q-item-section>
    </q-item>

    <!-- TPS -->

    <!-- Piece Counts -->
    <template v-if="hasPieceCounts">
      <template v-if="separatePieceCounts">
        <!-- Caps -->
        <q-item>
          <q-item-section avatar>
            <q-icon name="caps1" />
          </q-item-section>
          <q-item-section>
            <q-item-label subtitle>{{ $t("Caps1") }}</q-item-label>
            <q-item-label>{{ tags.caps1 }}</q-item-label>
          </q-item-section>
          <q-item-section>
            <q-item-label subtitle>{{ $t("Caps2") }}</q-item-label>
            <q-item-label>{{ tags.caps2 }}</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-icon name="caps2" />
          </q-item-section>
        </q-item>
        <!-- Flats -->
        <q-item>
          <q-item-section avatar>
            <q-icon name="flats1" />
          </q-item-section>
          <q-item-section>
            <q-item-label subtitle>{{ $t("Flats1") }}</q-item-label>
            <q-item-label>{{ tags.flats1 }}</q-item-label>
          </q-item-section>
          <q-item-section>
            <q-item-label subtitle>{{ $t("Flats2") }}</q-item-label>
            <q-item-label>{{ tags.flats2 }}</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-icon name="flats2" />
          </q-item-section>
        </q-item>
      </template>
      <template v-else>
        <!-- Caps -->
        <q-item>
          <q-item-section avatar>
            <q-icon name="caps1" />
          </q-item-section>
          <q-item-section>
            <q-item-label subtitle>{{ $t("Caps") }}</q-item-label>
            <q-item-label>{{ tags.caps }}</q-item-label>
          </q-item-section>
        </q-item>
        <!-- Flats -->
        <q-item>
          <q-item-section avatar>
            <q-icon name="flats1" />
          </q-item-section>
          <q-item-section>
            <q-item-label subtitle>{{ $t("Flats") }}</q-item-label>
            <q-item-label>{{ tags.flats }}</q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </template>

    <div class="row">
      <div class="col">
        <div class="row q-gutter-md q-mb-md">
          <PlayerName
            v-if="game && !game.isLocal && player === 1"
            class="col-grow"
            v-model="tags.player1"
            :player="player"
            :is-private="game.config.isPrivate"
            @keydown.enter.prevent="submit"
            hide-bottom-space
            hide-hint
          />

          <q-input
            v-else
            class="col-grow"
            v-model.trim="tags.player1"
            name="player1"
            :label="$t('Player1')"
            :rules="rules('player1')"
            :readonly="game && !game.isLocal"
            hide-bottom-space
            filled
          >
            <template v-slot:prepend>

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
            :readonly="game && !game.isLocal && player !== 1"
            hide-bottom-space
            filled
          >
            <template v-slot:prepend>
              <q-icon name="rating1" />
            </template>
          </q-input>
        </div>

        <div class="row q-gutter-md">
          <PlayerName
            v-if="game && !game.isLocal && player === 2"
            class="col-grow"
            v-model="tags.player2"
            :player="player"
            :is-private="game.config.isPrivate"
            @keydown.enter.prevent="submit"
            hide-bottom-space
            hide-hint
          />

          <q-input
            v-else
            class="col-grow"
            v-model.trim="tags.player2"
            name="player2"
            :label="$t('Player2')"
            :rules="rules('player2')"
            :readonly="game && !game.isLocal"
            hide-bottom-space
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
            filled
          >
            <template v-slot:prepend>
              <q-icon name="rating2" />
            </template>
          </q-input>
        </div>
      </div>
      <q-btn
        v-show="game && game.isLocal"
        @click="swapPlayers"
        icon="swap_vert"
        stretch
        dense
        flat
      />
    </div>

    <div
      v-show="isVisible('komi', 'opening')"
      class="row q-gutter-md q-mt-none"
    >
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
        filled
      >
        <template v-slot:prepend>
          <q-icon name="komi" />
        </template>
      </q-input>

      <q-select
        class="col-grow"
        v-show="isVisible('opening')"
        v-model="tags.opening"
        :options="openings"
        :label="$t('Opening')"
        name="opening"
        map-options
        emit-value
        filled
      >
        <template v-slot:prepend>
          <q-icon name="opening" />
        </template>
      </q-select>
    </div>

    <div v-show="isVisible('date', 'time')" class="row q-gutter-md q-mt-none">
      <q-input
        class="col-grow"
        v-show="isVisible('date')"
        v-model="tags.date"
        name="date"
        :label="$t('Date')"
        :rules="rules('date')"
        :readonly="game && !game.isLocal"
        hide-bottom-space
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
              today-btn
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
        :label="$t('Time')"
        :rules="rules('time')"
        :readonly="game && !game.isLocal"
        hide-bottom-space
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
              now-btn
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
    </div>

    <div class="row q-gutter-md q-mt-none">
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
        filled
      >
        <template v-slot:prepend>
          <q-icon name="clock" />
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
        hide-bottom-space
        filled
      >
        <template v-slot:prepend>
          <q-icon name="round" />
        </template>
      </q-input>
    </div>

    <div class="row q-gutter-md q-mt-none">
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
        filled
      >
        <template v-slot:prepend>
          <q-icon name="points" />
        </template>
      </q-input>
    </div>

    <q-input
      v-show="isVisible('site')"
      v-model.trim="tags.site"
      name="site"
      :label="$t('Site')"
      :rules="rules('site')"
      hide-bottom-space
      filled
    >
      <template v-slot:prepend>
        <q-icon name="site" />
      </template>
    </q-input>

    <q-input
      v-show="isVisible('event')"
      v-model.trim="tags.event"
      name="event"
      :label="$t('Event')"
      :rules="rules('event')"
      hide-bottom-space
      filled
    >
      <template v-slot:prepend>
        <q-icon name="event" />
      </template>
    </q-input>
  </q-list>
</template>

<script>
export default {
  name: "GameInfo",
  props: { name: String },
  computed: {
    game() {
      return this.$store.state.game;
    },
    tags() {
      return this.game.ptn.tags;
    },
    hasPieceCounts() {
      return ["caps", "flats", "caps1", "flats1", "caps2", "flats2"].some(
        (tag) => tag in this.tags
      );
    },
    separatePieceCounts() {
      return (
        this.tags.caps1 !== this.tags.caps2 ||
        this.tags.flats1 !== this.tags.flats2
      );
    },
  },
};
</script>
