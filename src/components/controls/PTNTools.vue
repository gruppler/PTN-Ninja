<template>
  <q-toolbar class="bg-ui q-pa-none">
    <q-btn-group class="full-width" spread stretch flat unelevated>
      <q-btn
        @click="showAllBranches = !showAllBranches"
        :text-color="showAllBranches ? 'primary' : ''"
      >
        <q-icon name="branch" class="rotate-180" />
        <hint>{{
          $t(showAllBranches ? "Hide Other Lines" : "Show All Branches")
        }}</hint>
      </q-btn>

      <q-btn
        @click="$router.push({ name: 'edit' })"
        icon="edit"
        :disabled="!isLocal"
      >
        <hint>{{ $t("Edit PTN") }}</hint>
      </q-btn>

      <q-btn icon="trim" class="no-border-radius" :disabled="!isLocal">
        <hint>{{ $t("Trim") }}</hint>
        <q-menu
          v-if="isLocal"
          transition-show="none"
          transition-hide="none"
          auto-close
          square
        >
          <q-list>
            <q-item clickable @click="$store.dispatch('game/TRIM_BRANCHES')">
              <q-item-section side>
                <q-icon name="branch" class="rotate-180" />
              </q-item-section>
              <q-item-section>{{ $t("Trim Branches") }}</q-item-section>
            </q-item>

            <q-item clickable @click="$store.dispatch('game/TRIM_TO_PLY')">
              <q-item-section side>
                <q-icon name="ply" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to Current Ply") }}</q-item-section>
            </q-item>

            <q-item clickable @click="$store.dispatch('game/TRIM_TO_BOARD')">
              <q-item-section side>
                <q-icon name="board" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to Current Board") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <slot />
    </q-btn-group>
  </q-toolbar>
</template>

<script>
export default {
  name: "PTN-Tools",
  data() {
    return {
      editDialog: false,
    };
  },
  computed: {
    isLocal() {
      return !this.$store.state.game.config.isOnline;
    },
    showAllBranches: {
      get() {
        return this.$store.state.ui.showAllBranches;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["showAllBranches", value]);
      },
    },
  },
};
</script>
