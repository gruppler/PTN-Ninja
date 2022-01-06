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
    white_rating: Number,
    black_rating: Number,
    ptn: String,
    playtak_id: Number,
  },

  methods: {
    async load_game() {
      let response = await fetch("http://127.0.0.1:5000/api/v1/game/465262");

      if(response.ok) {
        let data = await(response.json());
        console.log(data);
        let ninjatpn = data.ptn.split("\n");
        ninjatpn.splice(8, 2);
        ninjatpn = ninjatpn.join("\n");
        this.$store.dispatch("ADD_GAME", {
          ptn: ninjatpn,
          name: this.caption,
        });
      } else {
        alert("HTTP-Error: " + response.status);
      }
    },
  },

  computed: {
    caption() {
      return (
        this.white_player +
        " (" + this.white_rating + ")" +
        " vs." +
        this.black_player +
        " (" + this.black_rating + ")"
      );
    },
  },
};
</script>
