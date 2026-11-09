<template>
  <q-list>
    <!-- Engines in the Engines tab, sortable -->
    <draggable
      :value="shownEngines"
      :group="{ name: 'engines', pull: false, put: true }"
      :disabled="!canDrag"
      handle=".settings-engine-handle"
      ghost-class="settings-engine--ghost"
      class="settings-engines-added"
      @change="onAddedChange"
    >
      <q-item
        v-for="engine in shownEngines"
        :key="engine.value"
        :to="{ name: 'bot', params: { botID: engine.value } }"
        :data-engine="engine.value"
        clickable
        v-ripple
      >
        <q-item-section
          v-if="canDrag"
          class="settings-engine-handle"
          data-action="drag-engine"
          side
          @click.native.stop.prevent
        >
          <q-icon name="drag" />
        </q-item-section>
        <q-item-section avatar>
          <q-icon :name="engine.icon || 'engine'" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ engine.name }}</q-item-label>
          <q-item-label v-if="engine.version" caption>
            {{ engine.version }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="forward" />
        </q-item-section>
      </q-item>
    </draggable>

    <!-- Other engines: editable, and can be dragged up into the Engines tab,
         but not sorted among themselves -->
    <q-separator v-if="shownEngines.length && shownOtherEngines.length" />
    <draggable
      :value="shownOtherEngines"
      :group="{ name: 'engines', pull: true, put: false }"
      :sort="false"
      :disabled="!canDrag"
      handle=".settings-engine-handle"
      ghost-class="settings-engine--ghost"
    >
      <q-item
        v-for="engine in shownOtherEngines"
        :key="engine.value"
        :to="{ name: 'bot', params: { botID: engine.value } }"
        :data-engine="engine.value"
        data-added="false"
        clickable
        v-ripple
      >
        <q-item-section
          v-if="canDrag"
          class="settings-engine-handle"
          data-action="drag-engine"
          side
          @click.native.stop.prevent
        >
          <q-icon name="drag" />
        </q-item-section>
        <q-item-section avatar>
          <q-icon :name="engine.icon || 'engine'" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ engine.name }}</q-item-label>
          <q-item-label v-if="engine.version" caption>
            {{ engine.version }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="forward" />
        </q-item-section>
      </q-item>
    </draggable>

    <q-item
      @click="addEngine"
      data-action="add-engine"
      clickable
      v-close-popup
      v-ripple
    >
      <q-item-section avatar>
        <q-icon name="add" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ $t("Add Engine") }}</q-item-label>
      </q-item-section>
    </q-item>
  </q-list>
</template>

<script>
import draggable from "vuedraggable";
import { bots } from "../../bots";
import { normalizeText } from "../../settings/registry";

export default {
  name: "SettingsEngines",
  components: { draggable },
  inject: { settingsQuery: { default: () => () => "" } },
  computed: {
    // Not while searching, where only some engines are shown
    canDrag() {
      return !normalizeText(this.settingsQuery());
    },
    // While searching by an engine's name, only the engines that match
    shownEngines() {
      return this.engines.filter(this.matchesQuery);
    },
    shownOtherEngines() {
      return this.otherEngines.filter(this.matchesQuery);
    },
    // Active engines, skipping slots that have no engine chosen yet
    engines() {
      return this.$store.state.analysis.activeBots
        .filter((id) => id && bots[id])
        .map((id) => bots[id].listOption);
    },
    // Every other engine, in the engine picker's order
    otherEngines() {
      const added = this.$store.state.analysis.activeBots;
      return this.$store.state.analysis.botList
        .filter(({ value }) => bots[value] && !added.includes(value))
        .map(({ value }) => bots[value].listOption);
    },
  },
  methods: {
    matchesQuery(engine) {
      const query = normalizeText(this.settingsQuery());
      return (
        !query ||
        normalizeText(this.$t("Engines")).includes(query) ||
        [engine.name, engine.label].some((text) =>
          normalizeText(text).includes(query)
        )
      );
    },
    // A drop in the added list. Positions here skip empty slots, so map them
    // to activeBots indexes by the engines next to the drop.
    onAddedChange({ moved, added }) {
      const activeBots = this.$store.state.analysis.activeBots;
      const listed = this.engines.map((engine) => engine.value);
      if (moved) {
        const id = moved.element.value;
        const order = listed.slice();
        order.splice(moved.oldIndex, 1);
        order.splice(moved.newIndex, 0, id);
        const fromIndex = activeBots.indexOf(id);
        const rest = activeBots.filter((_, index) => index !== fromIndex);
        const toIndex =
          moved.newIndex === 0
            ? rest.indexOf(order[1])
            : rest.indexOf(order[moved.newIndex - 1]) + 1;
        if (toIndex >= 0 && toIndex !== fromIndex) {
          this.$store.dispatch("analysis/REORDER_ACTIVE_BOTS", {
            fromIndex,
            toIndex,
          });
        }
      } else if (added) {
        const index =
          added.newIndex < listed.length
            ? activeBots.indexOf(listed[added.newIndex])
            : listed.length
            ? activeBots.indexOf(listed[listed.length - 1]) + 1
            : activeBots.length;
        this.$store.dispatch("analysis/INSERT_ACTIVE_BOT", {
          index,
          botId: added.element.value,
        });
      }
    },
    // Close Settings (v-close-popup), show the Engines tab, and add an empty
    // slot as its Add Engine button does, with the slot expanded so its
    // engine picker is open
    addEngine() {
      this.$store.dispatch("ui/SET_UI", ["showText", true]);
      this.$store.dispatch("ui/SET_UI", ["textTab", "engines"]);
      this.$store.dispatch("analysis/SET_BOT_COLLAPSED", {
        botName: null,
        collapsed: false,
      });
      this.$store.dispatch("analysis/ADD_ACTIVE_BOT", null);
    },
  },
};
</script>

<style lang="scss">
.settings-engine-handle {
  cursor: grab;
  touch-action: none;
  padding-right: 8px;
}
// Room to drop an engine when none are added yet
.settings-engines-added {
  min-height: 8px;
}
.settings-engine--ghost {
  opacity: 0.4;
}
</style>
