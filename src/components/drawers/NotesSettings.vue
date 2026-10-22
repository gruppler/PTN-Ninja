<template>
  <div>
    <!-- Note Notifications -->
    <q-item :class="textClass" tag="label" v-ripple>
      <q-item-section>
        <q-item-label>{{ $t("Note Notifications") }}</q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-toggle v-model="notifyNotes" />
      </q-item-section>
    </q-item>

    <!-- Analysis Note Notifications -->
    <smooth-reflow v-if="!notesOnly">
      <q-item
        v-if="notifyNotes"
        :class="textClass"
        tag="label"
        v-ripple="notifyNotes"
      >
        <q-item-section>
          <q-item-label>{{ $t("Analysis Note Notifications") }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-toggle v-model="notifyAnalysisNotes" :disable="!notifyNotes" />
        </q-item-section>
      </q-item>
    </smooth-reflow>
  </div>
</template>

<script>
export default {
  name: "NotesSettings",
  props: {
    notesOnly: Boolean,
  },
  computed: {
    textClass() {
      return this.$store.state.ui.theme.panelDark
        ? "text-textLight"
        : "text-textDark";
    },
    notifyNotes: {
      get() {
        return this.$store.state.ui.notifyNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyNotes", value]);
      },
    },
    notifyAnalysisNotes: {
      get() {
        return this.$store.state.ui.notifyAnalysisNotes;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["notifyAnalysisNotes", value]);
      },
    },
  },
};
</script>
