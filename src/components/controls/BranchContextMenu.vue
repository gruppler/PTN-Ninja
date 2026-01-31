<template>
  <q-list class="bg-ui">
    <q-item @click="promoteBranch" clickable>
      <q-item-section side>
        <q-icon name="promote" />
      </q-item-section>
      <q-item-section>{{ $t("Promote") }}</q-item-section>
    </q-item>
    <q-item @click="makeBranchMain" clickable>
      <q-item-section side>
        <q-icon name="make_main" />
      </q-item-section>
      <q-item-section>{{ $t("Make Main") }}</q-item-section>
    </q-item>
    <q-item @click="renameBranch" clickable>
      <q-item-section side>
        <q-icon name="edit" />
      </q-item-section>
      <q-item-section>{{ $t("Rename") }}</q-item-section>
    </q-item>
    <q-item @click="deleteBranch" clickable>
      <q-item-section side>
        <q-icon name="delete" />
      </q-item-section>
      <q-item-section>{{ $t("Delete") }}</q-item-section>
    </q-item>
  </q-list>
</template>

<script>
export default {
  name: "BranchContextMenu",
  props: {
    branch: {
      type: String,
      required: true,
    },
  },
  methods: {
    promoteBranch() {
      this.$store.dispatch("game/PROMOTE_BRANCH", this.branch);
    },
    makeBranchMain() {
      this.$store.dispatch("game/MAKE_BRANCH_MAIN", this.branch);
    },
    renameBranch() {
      this.$router.push({
        name: "rename-branch",
        params: { branch: this.branch },
      });
    },
    deleteBranch() {
      this.$store.dispatch("game/DELETE_BRANCH", this.branch);
    },
  },
};
</script>
