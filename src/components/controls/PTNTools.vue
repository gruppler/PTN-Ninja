<template>
  <q-toolbar class="bg-secondary text-white q-pa-none">
    <q-btn-group class="full-width" spread stretch flat unelevated>
      <q-btn
        @click="showAllBranches = !showAllBranches"
        :title="$t('Show All Branches')"
        :text-color="showAllBranches ? 'accent' : ''"
        class="no-border-radius"
      >
        <q-icon name="call_split" class="rotate-180" />
      </q-btn>

      <q-btn @click="edit = true" icon="edit" :title="$t('Edit')" />

      <q-btn :title="$t('Trim')" class="no-border-radius">
        <q-icon name="flip" class="rotate-270" />
        <q-menu auto-close square>
          <q-list class="bg-secondary text-white">
            <q-item clickable @click="$store.dispatch('TRIM_BRANCHES', game)">
              <q-item-section side>
                <q-icon name="call_split" class="rotate-180" />
              </q-item-section>
              <q-item-section>{{ $t("Trim Branches") }}</q-item-section>
            </q-item>

            <q-item clickable @click="$store.dispatch('TRIM_TO_PLY', game)">
              <q-item-section side>
                <q-icon name="flip" class="rotate-270" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to Current Ply") }}</q-item-section>
            </q-item>

            <q-item clickable @click="$store.dispatch('TRIM_TO_BOARD', game)">
              <q-item-section side>
                <q-icon name="apps" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to Current Board") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <slot />
    </q-btn-group>

    <EditPTN v-model="edit" :game="game" />
  </q-toolbar>
</template>

<script>
import EditPTN from "../dialogs/EditPTN";

export default {
  name: "PTN-Tools",
  components: { EditPTN },
  props: ["game"],
  data() {
    return {
      edit: false
    };
  },
  computed: {
    showAllBranches: {
      get() {
        return this.$store.state.showAllBranches;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showAllBranches", value]);
      }
    }
  }
};
</script>
