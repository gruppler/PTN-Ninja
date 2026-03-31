<template>
  <q-item
    class="database-game q-pr-none q-py-none"
    :clickable="interactive"
    @click="handleClick"
    :class="[dark ? 'text-textLight' : 'text-textDark']"
    v-bind="$attrs"
  >
    <q-item-section class="q-py-sm player-section">
      <q-item-label class="player-label">
        <q-icon name="player1" left />
        <span class="player-name">{{ player1 }}</span>
        <strong class="player-rating">{{ rating1 }}</strong>
      </q-item-label>
      <q-item-label class="player-label">
        <q-icon name="player2" left />
        <span class="player-name">{{ player2 }}</span>
        <strong class="player-rating">{{ rating2 }}</strong>
      </q-item-label>
      <q-item-label v-if="date">
        <relative-time :value="date" style="margin: 0" />
      </q-item-label>
    </q-item-section>
    <q-item-section v-if="showPly && ply" class="q-py-sm" side>
      <Ply
        :ply="ply"
        no-click
        :tps="tps"
        :plies="ply && ply.text ? [ply.text] : null"
      />
    </q-item-section>
    <q-item-section class="fg-inherit q-mr-md q-py-sm" side>
      <slot name="side">
        <Result :result="result" />
        <div class="q-mt-xs q-gutter-x-sm">
          <q-icon v-if="tournament" name="event">
            <hint>{{ $t("analysis.tournamentGame") }}</hint>
          </q-icon>
          <span>
            <q-icon name="komi" class="q-mr-xs" />
            {{ komiString }}
            <hint>{{ $t("Komi") }} {{ komiString }}</hint>
          </span>
        </div>
      </slot>
    </q-item-section>
    <q-inner-loading :showing="loading" />
  </q-item>
</template>

<script>
import Ply from "../PTN/Ply";
import PlyClass from "../../Game/PTN/Ply";
import Result from "../PTN/Result";

export default {
  name: "DatabaseGame",
  components: { Ply, Result },
  props: {
    player1: String,
    player2: String,
    rating1: Number,
    rating2: Number,
    playtakId: Number,
    result: String,
    date: Date,
    komi: Number,
    tournament: Boolean,
    dark: Boolean,
    nextMove: String,
    interactive: {
      type: Boolean,
      default: true,
    },
    showPly: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      loading: false,
    };
  },
  computed: {
    komiString() {
      return (this.komi || 0).toString().replace(/0?\.5/, "½");
    },
    tps() {
      return this.$store.state.game.position.tps;
    },
    ply() {
      if (!this.nextMove) return null;
      const position = this.$store.state.game.position;
      return new PlyClass(this.nextMove, {
        id: null,
        player: position.turn,
        color: position.color,
      });
    },
  },
  methods: {
    handleClick() {
      if (this.interactive) {
        this.loadGame();
      }
    },
    loadGame() {
      const inNewTab = this.$store.state.analysis.dbSettings.openGamesInNewTab;
      this.loading = true;
      this.$store
        .dispatch(
          inNewTab ? "game/OPEN_TAKEXPLORER_GAME" : "game/ADD_TAKEXPLORER_GAME",
          {
            id: this.playtakId,
            state: {
              plyIndex: this.$store.state.game.position.plyIndex,
              plyIsDone: this.$store.state.game.position.plyIsDone,
            },
          }
        )
        .catch()
        .finally(() => {
          this.loading = false;
        });
    },
  },
};
</script>

<style lang="scss">
.database-game {
  overflow: hidden;
  max-width: 100%;

  + .database-game {
    border-top: 1px solid $separator-color;
    body.panelDark & {
      border-top-color: $separator-dark-color;
    }
  }

  .player-section {
    min-width: 0 !important;
    width: 0;
    overflow: hidden;
    flex: 1 1 0 !important;
  }

  .player-label {
    display: flex;
    align-items: center;
    white-space: nowrap;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;

    > .q-icon {
      flex-shrink: 0;
    }
  }

  .player-name {
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1 1 0;
  }

  .player-rating {
    flex-shrink: 0;
    margin-left: 0.25em;
  }
}
</style>
