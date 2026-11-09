<template>
  <q-list>
    <q-item
      v-for="(engine, index) in engines"
      :key="index"
      :to="{ name: 'bot', params: { botID: engine.value } }"
      clickable
      v-ripple
    >
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

    <q-item @click="addEngine" clickable v-ripple>
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

export default {
  name: "SettingsEngines",
  computed: {
    // Active engines, skipping slots that have no engine chosen yet
    engines() {
      return this.$store.state.analysis.activeBots
        .filter((id) => id && bots[id])
        .map((id) => bots[id].listOption);
    },
  },
  methods: {
    // As the Add Engine button in the Analysis panel does
    addEngine() {
      this.$store.dispatch("analysis/ADD_ACTIVE_BOT", null);
    },
  },
};
</script>
