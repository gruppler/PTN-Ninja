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

      <q-btn
        @click="edit = game.isLocal"
        icon="edit"
        :title="$t('Edit')"
        :disabled="!game.isLocal"
      />

      <q-btn
        :title="$t('Trim')"
        class="no-border-radius"
        :disabled="!game.isLocal"
      >
        <q-icon name="flip" class="rotate-270" />
        <q-menu v-if="game.isLocal" auto-close square>
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

      <q-btn icon="share" :title="$t('Share')">
        <q-menu auto-close square>
          <q-list class="bg-secondary text-white">
            <q-item clickable @click="copy('link')">
              <q-item-section side>
                <q-icon name="link" />
              </q-item-section>
              <q-item-section>{{ $t("Copy Link") }}</q-item-section>
            </q-item>

            <q-item clickable @click="copy('ply')">
              <q-item-section side>
                <q-icon name="layers" />
              </q-item-section>
              <q-item-section>{{ $t("Copy Ply") }}</q-item-section>
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

            <q-separator />

            <q-item clickable @click="download">
              <q-item-section side>
                <q-icon name="save_alt" />
              </q-item-section>
              <q-item-section>{{ $t("Download") }}</q-item-section>
            </q-item>

            <q-item
              v-if="!$store.state.embed && game.isLocal"
              clickable
              @click="embed"
            >
              <q-item-section side>
                <q-icon name="code" />
              </q-item-section>
              <q-item-section>{{ $t("Embed") }}</q-item-section>
            </q-item>

            <q-item v-if="!$store.state.embed" clickable @click="online">
              <q-item-section side>
                <q-icon name="public" />
              </q-item-section>
              <q-item-section>{{ $t("Online") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
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
        case "ply":
          text = this.game.state.ply.text();
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
    },
    online() {
      this.$emit("online");
    }
  }
};
</script>
