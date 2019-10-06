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
      <q-btn @click="copy" icon="file_copy" :title="$t('Copy to Clipboard')" />
      <q-btn icon="assignment_returned" :title="$t('Paste from Clipboard')" />
      <q-btn :title="$t('Trim')" class="no-border-radius">
        <q-icon name="flip" class="rotate-270" />
        <q-menu auto-close square>
          <q-list dark class="bg-secondary text-white">
            <q-item clickable>
              <q-item-section side>
                <q-icon name="flip" class="rotate-270" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to current ply") }}</q-item-section>
            </q-item>
            <q-item clickable>
              <q-item-section side>
                <q-icon name="apps" />
              </q-item-section>
              <q-item-section>{{ $t("Trim to current board") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </q-btn-group>
  </q-toolbar>
</template>

<script>
export default {
  name: "PTN-Tools",
  props: ["game"],
  computed: {
    showAllBranches: {
      get() {
        return this.$store.state.showAllBranches;
      },
      set(value) {
        this.$store.dispatch("SET_UI", ["showAllBranches", value]);
      }
    }
  },
  methods: {
    copy() {
      const el = document.createElement("textarea");
      el.value = this.game.ptn;
      el.setAttribute("readonly", "");
      el.style = { position: "absolute", left: "-9999px" };
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }
};
</script>
