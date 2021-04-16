<template>
  <q-btn class="caption" v-on:click="load_game()">
    {{ caption }}
  </q-btn>
</template>

<script>
export default {
  name: "DatabaseGame",

  props: {
    id: Number,
    white_player: String,
    black_player: String,
    result: String,
    white_rating: Number,
    black_rating: Number,
    ptn: String,
    playtak_id: Number,
  },

  methods: {
    load_game() {
      let ninjatpn = this.ptn.split("\n");
      ninjatpn.splice(8, 2);
      ninjatpn = ninjatpn.join("\n");
      this.$store.dispatch("ADD_GAME", {
        ptn: ninjatpn,
        name: this.caption,
      });
    },
  },

  computed: {
    caption() {
      return (
        this.white_player +
        " (" + this.white_rating + ")" +
        " vs." +
        this.black_player +
        " (" + this.black_rating + ")" +
        " : " +
        this.result
      );
    },
  },
};
</script>
