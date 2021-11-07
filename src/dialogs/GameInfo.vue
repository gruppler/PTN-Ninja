<template>
  <small-dialog
    :value="true"
    no-backdrop-dismiss
    v-bind="$attrs"
    v-on="$listeners"
  >
    <template v-slot:header>
      <dialog-header icon="info" :title="title">
        <template v-slot:buttons>
          <q-btn icon="open_in_new" @click="duplicate" dense flat />
          <q-btn
            v-if="isEditable"
            icon="edit"
            :to="{ name: 'info-edit' }"
            dense
            flat
          />
        </template>
      </dialog-header>
    </template>

    <q-list>
      <!-- Name -->
      <q-item>
        <q-item-section side>
          <q-icon :name="icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Name") }}</q-item-label>
          <q-item-label class="ellipsis">
            {{ name }}
            <tooltip>{{ name }}</tooltip>
          </q-item-label>
        </q-item-section>
      </q-item>

      <!-- Size -->
      <q-item>
        <q-item-section side>
          <q-icon name="size" class="flip-vertical" />
        </q-item-section>
        <q-item-section class="col-shrink">
          <q-item-label caption>{{ $t("Size") }}</q-item-label>
          <q-item-label>{{ tags.size }}&times;{{ tags.size }}</q-item-label>
        </q-item-section>

        <!-- TPS -->
        <template v-if="tags.tps">
          <q-item-section align="right">
            <q-item-label>
              <q-chip icon="copy" :label="$t('TPS')" @click="copyTPS" clickable>
                <tooltip>{{ tags.tps.text }}</tooltip>
              </q-chip>
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="board" />
          </q-item-section>
        </template>
      </q-item>

      <!-- Piece Counts -->
      <template v-if="hasPieceCounts">
        <template v-if="separatePieceCounts">
          <q-item>
            <!-- Caps -->
            <q-item-section side>
              <q-icon name="caps1" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Caps1") }}</q-item-label>
              <q-item-label>{{ tags.caps1 }}</q-item-label>
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Caps2") }}</q-item-label>
              <q-item-label>{{ tags.caps2 }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="caps2" />
            </q-item-section>
          </q-item>
          <!-- Flats -->
          <q-item>
            <q-item-section side>
              <q-icon name="flats1" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Flats1") }}</q-item-label>
              <q-item-label>{{ tags.flats1 }}</q-item-label>
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Flats2") }}</q-item-label>
              <q-item-label>{{ tags.flats2 }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="flats2" />
            </q-item-section>
          </q-item>
        </template>
        <template v-else>
          <q-item>
            <!-- Caps -->
            <q-item-section side>
              <q-icon name="caps1" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption>{{ $t("Caps") }}</q-item-label>
              <q-item-label>{{ tags.caps }}</q-item-label>
            </q-item-section>
            <!-- Flats -->
            <q-item-section align="right">
              <q-item-label caption>{{ $t("Flats") }}</q-item-label>
              <q-item-label>{{ tags.flats }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="flats1" />
            </q-item-section>
          </q-item>
        </template>
      </template>

      <!-- Player 1 -->
      <q-item>
        <q-item-section side>
          <q-icon
            :name="$store.getters['ui/playerIcon'](1, game.config.isPrivate)"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Player1") }}</q-item-label>
          <q-item-label>{{ tags.player1 }}</q-item-label>
        </q-item-section>

        <!-- Player 2 -->
        <q-item-section align="right">
          <q-item-label caption>{{ $t("Player2") }}</q-item-label>
          <q-item-label>{{ tags.player2 }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon
            :name="$store.getters['ui/playerIcon'](2, game.config.isPrivate)"
          />
        </q-item-section>
      </q-item>

      <q-item v-if="tags.rating1 || tags.rating2">
        <!-- Player 1 Rating -->
        <template v-if="tags.rating1">
          <q-item-section side>
            <q-icon name="rating1" />
          </q-item-section>
          <q-item-section>
            <q-item-label caption>{{ $t("Rating1") }}</q-item-label>
            <q-item-label>{{ tags.rating1 }}</q-item-label>
          </q-item-section>
        </template>

        <!-- Player 2 Rating -->
        <template v-if="tags.rating2">
          <q-item-section align="right">
            <q-item-label caption>{{ $t("Rating2") }}</q-item-label>
            <q-item-label>{{ tags.rating2 }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="rating2" />
          </q-item-section>
        </template>
      </q-item>

      <!-- Date/Time -->
      <q-item>
        <q-item-section side>
          <q-icon name="date_time" />
        </q-item-section>
        <q-item-section>
          <q-item-label>
            <relative-time :value="datetime" />
          </q-item-label>
        </q-item-section>
      </q-item>

      <!-- Clock -->
      <q-item v-if="tags.clock">
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

      <!-- Result -->
      <q-item v-if="tags.clock">
        <q-item-section side>
          <q-icon name="result" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Result") }}</q-item-label>
          <q-item-label>
            <Result :result="tags.result" />
            {{
              $t("result." + tags.result.type, {
                player: tags.result.winner
                  ? tags["player" + tags.result.winner] ||
                    $t("Player" + tags.result.winner)
                  : "",
              })
            }}
          </q-item-label>
        </q-item-section>

        <!-- Round -->
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

      <!-- Site -->
      <q-item v-if="tags.clock">
        <q-item-section side>
          <q-icon name="site" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Site") }}</q-item-label>
          <q-item-label>{{ tags.site }}</q-item-label>
        </q-item-section>
      </q-item>

      <!-- Event -->
      <q-item v-if="tags.clock">
        <q-item-section side>
          <q-icon name="event" />
        </q-item-section>
        <q-item-section>
          <q-item-label caption>{{ $t("Event") }}</q-item-label>
          <q-item-label>{{ tags.event }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>
  </small-dialog>
</template>

<script>
import Result from "../components/PTN/Result";

export default {
  name: "GameInfo",
  components: { Result },
  computed: {
    isEditable() {
      return !this.game.config.isOnline || this.game.config.player;
    },
    icon() {
      if (this.game.config.isOnline) {
        return this.$store.getters["ui/playerIcon"](
          this.game.config.player,
          this.game.config.isPrivate
        );
      } else {
        return "file";
      }
    },
    title() {
      return this.$t(this.game.config.isOnline ? "Online Game" : "Local Game");
    },
    name() {
      return this.$game.name;
    },
    datetime() {
      return this.$game.datetime;
    },
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
  methods: {
    copyTPS() {
      if (this.tags.tps) {
        this.$store.dispatch("ui/COPY", {
          text: this.tags.tps.text,
        });
      }
    },
    duplicate() {},
  },
};
</script>
