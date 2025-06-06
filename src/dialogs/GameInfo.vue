<template>
  <small-dialog ref="dialog" :value="true" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header :icon="icon" :title="title">
        <template v-if="!$store.state.ui.embed" v-slot:buttons>
          <q-btn
            v-if="isDuplicable"
            icon="copy"
            @click="duplicate"
            v-close-popup
            dense
            flat
          >
            <hint>{{ $t("Duplicate") }}</hint>
          </q-btn>
          <q-btn
            v-if="isEditable"
            icon="edit"
            @click="$router.replace({ name: 'info-edit' })"
            dense
            flat
          >
            <hint>{{ $t("Edit Game") }}</hint>
          </q-btn>
        </template>
      </dialog-header>
    </template>

    <q-list>
      <!-- Name -->
      <q-item>
        <q-item-section side>
          <q-icon name="file" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Name") }}</q-item-label>
          <q-item-label class="ellipsis">
            <span>
              <span class="text-selectable">{{ name }}</span>
              <tooltip>{{ name }}</tooltip>
            </span>
          </q-item-label>
        </q-item-section>
      </q-item>

      <!-- Date/Time -->
      <q-item v-if="tags.date || tags.time">
        <q-item-section side>
          <q-icon name="date_time" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            <relative-time v-if="tags.time" :value="datetime" invert />
            <relative-date v-else :value="datetime" invert />
          </q-item-label>
        </q-item-section>
      </q-item>

      <!-- Player 1 -->
      <q-item v-if="tags.player1">
        <q-item-section side>
          <q-icon
            :name="$store.getters['ui/playerIcon'](1, game.config.isPrivate)"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Player1") }}</q-item-label>
          <q-item-label class="text-selectable">{{
            tags.player1
          }}</q-item-label>
        </q-item-section>

        <!-- Player 1 Rating -->
        <template v-if="tags.rating1">
          <q-item-section align="right">
            <q-item-label caption>{{ $t("Rating1") }}</q-item-label>
            <q-item-label class="text-selectable">{{
              tags.rating1
            }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="rating1" />
          </q-item-section>
        </template>
      </q-item>

      <q-item v-if="tags.player2">
        <!-- Player 2 -->
        <q-item-section side>
          <q-icon
            :name="$store.getters['ui/playerIcon'](2, game.config.isPrivate)"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Player2") }}</q-item-label>
          <q-item-label class="text-selectable">{{
            tags.player2
          }}</q-item-label>
        </q-item-section>

        <!-- Player 2 Rating -->
        <template v-if="tags.rating2">
          <q-item-section align="right">
            <q-item-label caption>{{ $t("Rating2") }}</q-item-label>
            <q-item-label class="text-selectable">{{
              tags.rating2
            }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="rating2" />
          </q-item-section>
        </template>
      </q-item>

      <!-- Size -->
      <q-item>
        <q-item-section side>
          <q-icon name="size" class="flip-vertical" />
        </q-item-section>
        <q-item-section class="col-shrink">
          <q-item-label caption>{{ $t("Size") }}</q-item-label>
          <q-item-label>{{ tags.size }}x{{ tags.size }}</q-item-label>
        </q-item-section>

        <!-- TPS -->
        <template v-if="tags.tps">
          <q-item-section align="right">
            <q-item-label>
              <q-btn icon="copy" :label="$t('TPS')" @click="copyTPS" dense flat>
                <tooltip>{{ tags.tps.text }}</tooltip>
              </q-btn>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="board">
              <PlyPreview :tps="tags.tps.text" :options="game.config" />
            </q-icon>
          </q-item-section>
        </template>
      </q-item>

      <!-- Piece Counts -->
      <template v-if="hasPieceCounts">
        <template v-if="separatePieceCounts">
          <!-- Player 1 Pieces -->
          <q-item>
            <!-- Flats 1 -->
            <q-item-section side>
              <q-icon name="flats1" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Flats1") }}</q-item-label>
              <q-item-label
                :class="{ disabled: !tags.flats && !tags.flats1 }"
                >{{ game.config.pieceCounts[1].flat }}</q-item-label
              >
            </q-item-section>
            <!-- Caps 1 -->
            <q-item-section align="right">
              <q-item-label caption>{{ $t("Caps1") }}</q-item-label>
              <q-item-label :class="{ disabled: !tags.caps && !tags.caps1 }">{{
                game.config.pieceCounts[1].cap
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="caps1" />
            </q-item-section>
          </q-item>

          <!-- Player 2 Pieces -->
          <q-item>
            <!-- Flats 2 -->
            <q-item-section side>
              <q-icon name="flats2" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Flats2") }}</q-item-label>
              <q-item-label
                :class="{ disabled: !tags.flats && !tags.flats2 }"
                >{{ game.config.pieceCounts[2].flat }}</q-item-label
              >
            </q-item-section>
            <!-- Caps 2 -->
            <q-item-section align="right">
              <q-item-label caption>{{ $t("Caps2") }}</q-item-label>
              <q-item-label :class="{ disabled: !tags.caps && !tags.caps2 }">{{
                game.config.pieceCounts[2].cap
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="caps2" />
            </q-item-section>
          </q-item>
        </template>
        <template v-else>
          <q-item>
            <!-- Flats -->
            <q-item-section side>
              <q-icon name="flats1" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Flats") }}</q-item-label>
              <q-item-label :class="{ disabled: !tags.caps }">{{
                game.config.pieceCounts[1].flat
              }}</q-item-label>
            </q-item-section>
            <!-- Caps -->
            <q-item-section align="right">
              <q-item-label caption>{{ $t("Caps") }}</q-item-label>
              <q-item-label :class="{ disabled: !tags.caps }">{{
                game.config.pieceCounts[1].cap
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="caps1" />
            </q-item-section>
          </q-item>
        </template>
      </template>

      <q-item v-if="tags.komi">
        <!-- Komi -->
        <q-item-section side>
          <q-icon name="komi" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Komi") }}</q-item-label>
          <q-item-label>{{ tags.komi }}</q-item-label>
        </q-item-section>
        <!-- Opening -->
        <template v-if="tags.opening && tags.opening !== 'swap'">
          <q-item-section align="right">
            <q-item-label caption>{{ $t("Opening") }}</q-item-label>
            <q-item-label>{{ $t("openings." + tags.opening) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="opening" />
          </q-item-section>
        </template>
      </q-item>
      <q-item v-else-if="tags.opening && tags.opening !== 'swap'">
        <!-- Opening -->
        <q-item-section side>
          <q-icon name="opening" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Opening") }}</q-item-label>
          <q-item-label>{{ $t("openings." + tags.opening) }}</q-item-label>
        </q-item-section>
      </q-item>

      <q-item v-if="tags.clock">
        <!-- Clock -->
        <q-item-section side>
          <q-icon name="clock" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Clock") }}</q-item-label>
          <q-item-label>{{ tags.clock }}</q-item-label>
        </q-item-section>
        <!-- Round -->
        <template v-if="tags.round">
          <q-item-section align="right">
            <q-item-label caption>{{ $t("Round") }}</q-item-label>
            <q-item-label>{{ tags.round }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="round" />
          </q-item-section>
        </template>
      </q-item>
      <q-item v-else-if="tags.round">
        <!-- Round -->
        <q-item-section side>
          <q-icon name="round" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Round") }}</q-item-label>
          <q-item-label>{{ tags.round }}</q-item-label>
        </q-item-section>
      </q-item>

      <q-item v-if="tags.result">
        <!-- Result -->
        <q-item-section side>
          <q-icon name="result" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Result") }}</q-item-label>
          <q-item-label>
            <Result :result="tags.result" />&nbsp;
            <span class="text-selectable">{{
              $t("result." + tags.result.type, {
                player: tags.result.winner
                  ? tags["player" + tags.result.winner] ||
                    $t("Player" + tags.result.winner)
                  : "",
              })
            }}</span>
          </q-item-label>
        </q-item-section>
        <!-- Points -->
        <template v-if="tags.points">
          <q-item-section class="col-shrink" align="right">
            <q-item-label caption>{{ $t("Points") }}</q-item-label>
            <q-item-label>{{ tags.points }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="points" />
          </q-item-section>
        </template>
      </q-item>

      <!-- Event -->
      <q-item v-if="tags.event">
        <q-item-section side>
          <q-icon name="event" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Event") }}</q-item-label>
          <q-item-label class="text-selectable">
            {{ tags.event }}
          </q-item-label>
        </q-item-section>
      </q-item>

      <!-- Site -->
      <q-item v-if="tags.site">
        <q-item-section side>
          <q-icon name="site" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Site") }}</q-item-label>
          <q-item-label class="text-selectable">
            {{ tags.site }}
          </q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </small-dialog>
</template>

<script>
import PlyPreview from "../components/controls/PlyPreview";
import Result from "../components/PTN/Result";

export default {
  name: "GameInfo",
  components: { PlyPreview, Result },
  props: {
    value: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    isEditable() {
      return !this.game.config.isOnline || this.game.config.player;
    },
    isDuplicable() {
      return !(this.game.config.isOnline && this.game.config.isOngoing);
    },
    icon() {
      return this.$store.state.ui.embed
        ? "info"
        : this.game.config.isOnline
        ? "online"
        : "local";
    },
    title() {
      return this.$t(
        this.$store.state.ui.embed
          ? "Game Info"
          : this.game.config.isOnline
          ? "Online Game"
          : "Local Game"
      );
    },
    name() {
      return this.$store.state.ui.embed
        ? this.game.name
        : this.$store.state.game.list[0].name;
    },
    datetime() {
      return this.game.ptn.tags.datetime;
    },
    game() {
      return this.$store.state.game;
    },
    tags() {
      return this.game.ptn.tags;
    },
    hasPieceCounts() {
      return this.game.config.hasCustomPieceCount;
    },
    separatePieceCounts() {
      return (
        this.tags.caps1 !== this.tags.caps2 ||
        this.tags.flats1 !== this.tags.flats2
      );
    },
  },
  methods: {
    copyTPS() {
      if (this.tags.tps) {
        this.$store.dispatch("ui/COPY", {
          text: this.tags.tps.text,
          title: this.$t("TPS"),
        });
      }
    },
    duplicate() {
      this.$store.dispatch("game/ADD_GAME", this.$game);
    },
  },
};
</script>
