<template>
  <q-menu
    content-class="bg-primary"
    align="bottom right"
    self="top left"
    auto-close
    dark
  >
    <q-list dense>
      <q-item
        v-for="(ply, i) in branches"
        :key="i"
        @click="select(ply)"
        clickable
      >
        <q-item-section side>
          <strong class="q-pa-sm text-white">{{ i }}</strong>
        </q-item-section>
        <q-item-label>
          <Ply :ply="ply" :game="game" :noBranches="true" :noClick="true" />
        </q-item-label>
      </q-item>
    </q-list>
  </q-menu>
</template>

<script>
import Ply from "./Ply";

export default {
  name: "BranchMenu",
  components: { Ply },
  props: ["game", "branches"],
  methods: {
    select(ply) {
      this.$emit("input", ply);
    }
  }
};
</script>

<style></style>
