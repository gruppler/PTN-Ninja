<template>
  <q-toolbar class="bg-ui q-pa-none">
    <q-btn-group class="full-width" spread stretch flat unelevated>
      <q-btn
        @click="showAllBranches = !showAllBranches"
        :title="$t('Show All Branches')"
        :text-color="showAllBranches ? 'primary' : ''"
        class="no-border-radius"
      >
        <q-icon name="branch" class="rotate-180" />
      </q-btn>

      <q-btn
        @click="$router.push({ name: 'edit' })"
        icon="edit"
        :title="$t('Edit')"
        :disabled="!isLocal"
      />

      <q-btn
        icon="trim"
        :title="$t('Trim')"
        class="no-border-radius"
        :disabled="!isLocal"
      >
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
