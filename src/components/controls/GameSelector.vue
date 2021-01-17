<template>
  <div class="game-selector no-wrap">
    <q-select
      ref="select"
      v-if="games.length"
      class="text-subtitle1 no-wrap"
      :value="0"
      :options="games"
      @input="select"
      @keydown.esc="$refs.select.blur"
      @keydown.delete="close($refs.select.optionIndex)"
      :display-value="name"
      :hide-dropdown-icon="$q.screen.lt.sm"
      behavior="menu"
      popup-content-class="game-selector-options"
      emit-value
      filled
      dense
    >
      <template v-slot:prepend>
        <q-btn
          :label="games.length"
          @click.stop
          class="text-subtitle2 q-pa-sm"
          dense
          flat
        >
          <q-menu auto-close square>
            <q-list>
              <q-item
                clickable
                @click="dialogCloseGames = true"
                :disable="games.length < 2"
              >
                <q-item-section side>
                  <q-icon name="close_multiple" />
                </q-item-section>
                <q-item-section>{{ $t("Close") }}...</q-item-section>
              </q-item>
              <q-item clickable @click="dialogDownloadGames = true">
                <q-item-section side>
                  <q-icon name="download" />
                </q-item-section>
                <q-item-section>{{ $t("Download") }}...</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <q-separator vertical class="q-mr-sm" />
      </template>

      <template v-slot:option="scope">
        <q-item
          class="non-selectable"
          v-bind="scope.itemProps"
          v-on="scope.itemEvents"
        >
          <q-item-section>
            <q-item-label>{{ scope.opt.label }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              @click.stop="close(scope.opt.value)"
              icon="close"
              flat
              dense
            />
          </q-item-section>
        </q-item>
      </template>

      <template v-slot:append>
        <div class="row">
          <slot />
        </div>
      </template>
    </q-select>

    <CloseGames v-model="dialogCloseGames" no-route-dismiss />
    <DownloadGames v-model="dialogDownloadGames" no-route-dismiss />
  </div>
</template>

<script>
import CloseGames from "../dialogs/CloseGames";
import DownloadGames from "../dialogs/DownloadGames";

import { zipObject } from "lodash";

const HISTORY_DIALOGS = {
  dialogCloseGames: "close",
  dialogDownloadGames: "download",
};

export default {
  name: "GameSelector",
  components: { CloseGames, DownloadGames },
  props: ["game"],
  computed: {
    ...zipObject(
      Object.keys(HISTORY_DIALOGS),
      Object.values(HISTORY_DIALOGS).map((name) => ({
        get() {
          return this.$route.name === name;
        },
        set(value) {
          if (value) {
            if (this.$route.name !== name) {
              this.$router.push({ name });
            }
          } else {
            if (this.$route.name === name) {
              this.$router.go(-1);
              this.$router.replace({ name: "local" });
            }
          }
        },
      }))
    ),

    games() {
      return this.$store.state.games.map((game, index) => ({
        label: game.name,
        value: index,
      }));
    },
    name() {
      return this.games[0].label;
    },
    isEditingTPS: {
      get() {
        return this.$store.state.isEditingTPS;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["isEditingTPS", value]);
        if (!value) {
          this.editingTPS = "";
        }
      },
    },
    editingTPS: {
      get() {
        return this.$store.state.editingTPS;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["editingTPS", value]);
      },
    },
  },
  methods: {
    select(index) {
      const _select = () => {
        this.$store.dispatch("SELECT_GAME", { index });
        this.$emit("input", this.$store.state.games[0]);
        this.editingTPS = "";
        this.isEditingTPS = false;
      };
      if (index >= 0 && this.games.length > index) {
        if (this.isEditingTPS && this.editingTPS !== main.game.state.tps) {
          this.$store.dispatch("PROMPT", {
            title: this.$t("Confirm"),
            message: this.$t("confirm.abandonChanges"),
            success: _select,
          });
        } else {
          _select();
        }
      }
    },
    close(index) {
      this.$store.dispatch("REMOVE_GAME", index);
    },
  },
};
</script>

<style lang="scss">
.game-selector {
  max-width: 30em;
  margin: 0 auto;
  .q-field--filled .q-field__control {
    padding-left: 0;
    @media (max-width: $breakpoint-xs-max) {
      padding-right: 0;
    }
  }

  .q-field__native {
    span {
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      @media (max-width: $breakpoint-xs-max) {
        font-size: 0.85em;
      }
    }

    .no-outline {
      position: absolute;
    }
  }
  .q-badge {
    align-self: center;
    padding: 5px;
    font-weight: bold;
  }
}

.game-selector-options {
  .q-badge {
    padding: 4px;
  }
}
</style>
