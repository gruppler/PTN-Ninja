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

      <q-btn :title="$t('Trim')" class="no-border-radius">
        <q-icon name="flip" class="rotate-270" />
        <q-menu auto-close dark square>
          <q-list dark class="bg-secondary text-white">
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

      <q-btn icon="share" :title="$t('Share')">
        <q-menu auto-close dark square>
          <q-list dark class="bg-secondary text-white">
            <q-item clickable @click="copy('link')">
              <q-item-section side>
                <q-icon name="link" />
              </q-item-section>
              <q-item-section>{{ $t("Copy Link") }}</q-item-section>
            </q-item>

            <q-item clickable @click="copy('moves')">
              <q-item-section side>
                <q-icon name="format_list_numbered" />
              </q-item-section>
              <q-item-section>{{ $t("Copy Moves") }}</q-item-section>
            </q-item>

            <q-item clickable @click="copy('ptn')">
              <q-item-section side>
                <q-icon name="file_copy" />
              </q-item-section>
              <q-item-section>{{ $t("Copy PTN") }}</q-item-section>
            </q-item>

            <q-item clickable @click="download">
              <q-item-section side>
                <q-icon name="save_alt" />
              </q-item-section>
              <q-item-section>{{ $t("Download") }}</q-item-section>
            </q-item>

            <q-item v-if="!$store.state.embed" clickable @click="embed">
              <q-item-section side>
                <q-icon name="code" />
              </q-item-section>
              <q-item-section>{{ $t("Embed") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>

      <!-- <q-btn icon="edit" :title="$t('Edit')" /> -->
      <!-- <q-btn icon="assignment_returned" :title="$t('Paste from Clipboard')" /> -->
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
    copy(type) {
      let text;
      switch (type) {
        case "link":
          text = this.$store.getters.url(this.game, {
            origin: true,
            state: true
          });
          break;
        case "moves":
          text = this.game.moveText(this.showAllBranches);
          break;
        case "ptn":
          text = this.game.ptn;
          break;
      }
      this.$store.dispatch("COPY", {
        text,
        message: this.$t("Copied")
      });
    },
    download() {
      this.$store.dispatch("SAVE", this.game);
    },
    embed() {
      this.$emit("embed");
    }
  }
};
</script>
