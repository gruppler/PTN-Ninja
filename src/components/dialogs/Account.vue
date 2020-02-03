<template>
  <q-dialog :value="value" @input="$emit('input', $event)" v-bind="$attrs">
    <q-card style="width: 300px" class="bg-secondary">
      <q-card-section>
        <PlayerName ref="playerName" :player="1" />
      </q-card-section>

      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import PlayerName from "../controls/PlayerName";

export default {
  name: "Account",
  components: { PlayerName },
  props: ["value"],
  computed: {
    user() {
      return this.$store.state.oline ? this.$store.state.oline.user : null;
    }
  },
  methods: {
    close() {
      this.$emit("input", false);
    }
  }
};
</script>
