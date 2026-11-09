<template>
  <q-list>
    <q-item
      v-for="(engine, position) in shownEngines"
      :key="engine.value"
      ref="rows"
      :to="{ name: 'bot', params: { botID: engine.value } }"
      :class="{ 'settings-engine--dragging': dragging === engine.value }"
      :data-engine="engine.value"
      clickable
      v-ripple
    >
      <q-item-section
        v-if="canReorder"
        class="settings-engine-handle"
        data-action="drag-engine"
        side
        @pointerdown.native.stop.prevent="startDrag($event, position)"
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

    <!-- Engines not added to the Engines tab: editable, not sortable -->
    <q-separator v-if="shownEngines.length && shownOtherEngines.length" />
    <q-item
      v-for="engine in shownOtherEngines"
      :key="engine.value"
      :to="{ name: 'bot', params: { botID: engine.value } }"
      :data-engine="engine.value"
      data-added="false"
      clickable
      v-ripple
    >
      <q-item-section v-if="canReorder" class="settings-engine-spacer" side>
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
import { bots } from "../../bots";
import { normalizeText } from "../../settings/registry";

export default {
  name: "SettingsEngines",
  inject: { settingsQuery: { default: () => () => "" } },
  data() {
    return {
      // Engine ids in the order shown while dragging, else null
      dragOrder: null,
      dragging: null,
    };
  },
  beforeDestroy() {
    this.stopDrag();
  },
  computed: {
    // Not while searching, where only some engines are shown
    canReorder() {
      return !normalizeText(this.settingsQuery()) && this.engines.length > 1;
    },
    // While searching by an engine's name, only the engines that match
    shownEngines() {
      if (this.dragOrder) {
        return this.dragOrder.map((id) =>
          this.engines.find((engine) => engine.value === id)
        );
      }
      return this.engines.filter(this.matchesQuery);
    },
    shownOtherEngines() {
      return this.otherEngines.filter(this.matchesQuery);
    },
    // Every other engine, in the engine picker's order
    otherEngines() {
      const added = this.$store.state.analysis.activeBots;
      return this.$store.state.analysis.botList
        .filter(({ value }) => bots[value] && !added.includes(value))
        .map(({ value }) => bots[value].listOption);
    },
    // Active engines, skipping slots that have no engine chosen yet
    engines() {
      return this.$store.state.analysis.activeBots
        .filter((id) => id && bots[id])
        .map((id) => bots[id].listOption);
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
    // Drag a row by its handle; rows reorder live, and the store updates once
    // on release
    startDrag(event, position) {
      if (event.button !== 0 && event.pointerType === "mouse") {
        return;
      }
      this.stopDrag();
      this.dragOrder = this.engines.map((engine) => engine.value);
      this.dragging = this.dragOrder[position];
      this.onDragMove = (e) => this.dragMove(e);
      this.onDragEnd = () => this.endDrag();
      window.addEventListener("pointermove", this.onDragMove);
      window.addEventListener("pointerup", this.onDragEnd);
      window.addEventListener("pointercancel", this.onDragEnd);
    },
    dragMove(event) {
      const rows = (this.$refs.rows || [])
        .map((row) => row.$el)
        .sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top
        );
      const from = this.dragOrder.indexOf(this.dragging);
      // The row whose middle the pointer has passed
      let to = 0;
      rows.forEach((row, index) => {
        const rect = row.getBoundingClientRect();
        if (event.clientY > rect.top + rect.height / 2) {
          to = index;
        }
      });
      if (event.clientY < rows[0].getBoundingClientRect().bottom) {
        to = 0;
      }
      if (to !== from) {
        const order = this.dragOrder.slice();
        order.splice(from, 1);
        order.splice(to, 0, this.dragging);
        this.dragOrder = order;
      }
    },
    endDrag() {
      const order = this.dragOrder;
      const id = this.dragging;
      this.stopDrag();
      // Dropped where it started (or a plain click on the handle)
      if (
        !order ||
        order.join() === this.engines.map((engine) => engine.value).join()
      ) {
        return;
      }
      const activeBots = this.$store.state.analysis.activeBots;
      const fromIndex = activeBots.indexOf(id);
      // Where it lands among activeBots once removed: before the engine now
      // after it, or right after the engine now before it (empty slots
      // aren't listed here, so place it relative to its listed neighbors)
      const rest = activeBots.filter((_, index) => index !== fromIndex);
      const position = order.indexOf(id);
      const toIndex =
        position === 0
          ? rest.indexOf(order[1])
          : rest.indexOf(order[position - 1]) + 1;
      if (toIndex >= 0 && toIndex !== fromIndex) {
        this.$store.dispatch("analysis/REORDER_ACTIVE_BOTS", {
          fromIndex,
          toIndex,
        });
      }
    },
    stopDrag() {
      window.removeEventListener("pointermove", this.onDragMove);
      window.removeEventListener("pointerup", this.onDragEnd);
      window.removeEventListener("pointercancel", this.onDragEnd);
      this.dragOrder = null;
      this.dragging = null;
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
// Keeps other engines' icons in line with the sortable rows above
.settings-engine-spacer {
  visibility: hidden;
  padding-right: 8px;
}
.settings-engine--dragging {
  background: rgba(128, 128, 128, 0.2);
  .settings-engine-handle {
    cursor: grabbing;
  }
}
</style>
