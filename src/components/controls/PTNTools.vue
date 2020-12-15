<template>
  <q-toolbar class="bg-secondary text-white q-pa-none">
    <q-btn-group class="full-width" spread stretch flat unelevated>
      <q-btn
        @click="showAllBranches = !showAllBranches"
        :title="$t('Show All Branches')"
        :text-color="showAllBranches ? 'accent' : ''"
        class="no-border-radius"
      >
        <q-icon name="branch" class="rotate-180" />
      </q-btn>

      <q-btn
        @click="editDialog = game.isLocal"
        icon="edit"
        :title="$t('Edit')"
        :disabled="!game.isLocal"
      />

      <q-btn
        :title="$t('Trim')"
        class="no-border-radius"
        :disabled="!game.isLocal"
      >
        <q-icon name="trim" class="rotate-180" />
        <q-menu v-if="game.isLocal" auto-close square>
          <q-list class="bg-secondary text-white">
            <q-item clickable @click="$store.dispatch('TRIM_BRANCHES', game)">
              <q-item-section side>
                <q-icon name="branch" class="rotate-180" />
              </q-item-section>
              <q-item-section>{{ $t("Trim Branches") }}</q-item-section>
            </q-item>

            <q-item clickable @click="$store.dispatch('TRIM_TO_PLY', game)">
              <q-item-section side>
                <q-icon name="trim" class="rotate-180" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to Current Ply") }}</q-item-section>
            </q-item>

            <q-item clickable @click="$store.dispatch('TRIM_TO_BOARD', game)">
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

    <EditPTN v-model="editDialog" :game="game" no-route-dismiss />
  </q-toolbar>
</template>

<script>
import EditPTN from "../dialogs/EditPTN";

export default {
  name: "PTN-Tools",
  components: { EditPTN },
  props: ["game", "showEditor"],
  data() {
    return {
      editDialog: false,
    };
  },
  computed: {
    showAllBranches: {
      get() {
        return this.$store.state.showAllBranches;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showAllBranches", value]);
      },
    },
  },
  watch: {
    editDialog(isVisible) {
      this.$emit("update:showEditor", isVisible);
    },
    showEditor(isVisible) {
      this.editDialog = isVisible;
    },
  },
};
</script>
