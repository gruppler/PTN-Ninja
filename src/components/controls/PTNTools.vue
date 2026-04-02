<template>
  <q-toolbar class="bg-ui q-pa-none">
    <q-btn-group class="full-width" spread stretch flat unelevated>
      <q-btn
        :icon="branchDisplayIcon"
        spread
        stretch
        flat
        @click.right.prevent="toggleBranchMode"
        color="primary"
      >
        <hint>{{ branchDisplayLabel }}</hint>
        <q-menu transition-show="none" transition-hide="none" auto-close square>
          <q-list>
            <q-item
              clickable
              @click="setBranchMode('current')"
              :active="branchMode === 'current'"
              active-color="primary"
            >
              <q-item-section avatar>
                <q-icon name="branches_none" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Current Branch") }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              clickable
              @click="setBranchMode('inline')"
              :active="branchMode === 'inline'"
              active-color="primary"
            >
              <q-item-section avatar>
                <q-icon name="branch" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("Inline Branches") }}</q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              clickable
              @click="setBranchMode('all')"
              :active="branchMode === 'all'"
              active-color="primary"
            >
              <q-item-section avatar>
                <q-icon name="branches_all" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ $t("All Branches") }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn icon="trim" spread stretch flat :disabled="!isLocal">
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
                <q-icon name="branch" />
              </q-item-section>
              <q-item-section>{{ $t("Trim Branches") }}</q-item-section>
            </q-item>

            <q-item
              clickable
              :disable="!canTrimToPly"
              @click="$store.dispatch('game/TRIM_TO_PLY')"
            >
              <q-item-section side>
                <q-icon name="ply" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to Current Ply") }}</q-item-section>
            </q-item>

            <q-item
              clickable
              :disable="!canTrimToBoard"
              @click="$store.dispatch('game/TRIM_TO_BOARD')"
            >
              <q-item-section side>
                <q-icon name="board" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to Current Board") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <q-btn
        @click="$router.push({ name: 'edit' })"
        icon="edit_ptn"
        :disabled="!isLocal || !canEditCurrentPTN"
      >
        <hint>{{ $t("Edit PTN") }}</hint>
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
    canEditCurrentPTN() {
      return this.$store.getters["game/canEditCurrentPTN"];
    },
    canTrimToBoard() {
      return this.$store.getters["game/canTrimToBoard"];
    },
    canTrimToPly() {
      return this.$store.getters["game/canTrimToPly"];
    },
    branchMode: {
      get() {
        const showAllBranches = this.$store.state.ui.showAllBranches;
        const inlineBranches = this.$store.state.ui.inlineBranches;

        return showAllBranches
          ? inlineBranches
            ? "inline"
            : "all"
          : "current";
      },
      set(value) {
        let showAllBranches, inlineBranches;

        switch (value) {
          case "all":
            showAllBranches = true;
            inlineBranches = false;
            break;
          case "inline":
            showAllBranches = true;
            inlineBranches = true;
            break;
          default:
          case "current":
            showAllBranches = false;
            break;
        }

        this.$store.dispatch("ui/SET_UI", ["showAllBranches", showAllBranches]);
        this.$store.dispatch("ui/SET_UI", ["inlineBranches", inlineBranches]);
      },
    },
    branchDisplayLabel() {
      switch (this.branchMode) {
        case "all":
          return this.$t("All Branches");
        case "inline":
          return this.$t("Inline Branches");
        case "current":
        default:
          return this.$t("Current Branch");
      }
    },
    branchDisplayIcon() {
      switch (this.branchMode) {
        case "all":
          return "branches_all";
        case "inline":
          return "branch";
        default:
        case "current":
          return "branches_none";
      }
    },
  },
  methods: {
    setBranchMode(mode) {
      this.branchMode = mode;
    },
    toggleBranchMode() {
      this.$store.dispatch("ui/TOGGLE_UI", "showAllBranches");
    },
  },
};
</script>
