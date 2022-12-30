<template>
  <small-dialog :value="true" content-class="non-selectable" v-bind="$attrs">
    <template v-slot:header>
      <dialog-header icon="online">{{ $t("Online") }}</dialog-header>
    </template>

    <q-card style="width: 330px; max-width: 100%">
      <smooth-reflow class="col">
        <q-list v-if="isLocal" separator>
          <!-- Play -->
          <q-item :to="{ name: 'play-online' }" replace clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="players" />
            </q-item-section>
            <q-item-section>{{ $t("Play Online") }}</q-item-section>
          </q-item>

          <!-- Analysis -->
          <q-item :to="{ name: 'analysis-online' }" replace clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="analysis" />
            </q-item-section>
            <q-item-section>{{ $t("New Analysis") }}</q-item-section>
          </q-item>

          <!-- Puzzle -->
          <q-item :to="{ name: 'puzzle-online' }" replace clickable v-ripple>
            <q-item-section avatar>
              <q-icon name="puzzle" />
            </q-item-section>
            <q-item-section>{{ $t("New Puzzle") }}</q-item-section>
          </q-item>
        </q-list>

        <q-list v-else>
          <q-item>
            <q-input
              class="col-grow"
              :value="gameURL"
              :hint="isSpectator ? $t('hint.spectate') : $t('hint.url')"
              readonly
              filled
            >
              <template v-slot:prepend>
                <q-icon name="url" />
              </template>
              <template v-slot:append>
                <q-icon
                  @click="qrCode(gameURL)"
                  name="qrcode"
                  class="q-field__focusable-action"
                  left
                />
                <q-icon
                  @click="copy(gameURL)"
                  name="copy"
                  class="q-field__focusable-action"
                />
              </template>
            </q-input>
          </q-item>
        </q-list>
      </smooth-reflow>
    </q-card>

    <template v-slot:footer>
      <q-separator />

      <message-output :error="error" content-class="q-ma-md" />

      <q-card-actions align="right">
        <q-btn
          :label="$t(isLocal ? 'Cancel' : 'Close')"
          color="primary"
          flat
          v-close-popup
        />
      </q-card-actions>
    </template>
  </small-dialog>
</template>

<script>
export default {
  name: "ShareOnline",
  data() {
    return {
      error: "",
      qrText: "",
    };
  },
  computed: {
    showQR: {
      get() {
        return !!this.$route.params.qr;
      },
      set(value) {
        if (value) {
          if (!this.$route.params.qr) {
            this.$router.push({ params: { qr: "qr" } });
          }
        } else {
          if (this.$route.params.qr) {
            this.$router.go(-1);
            this.$router.replace({ params: { qr: null } });
          }
        }
      },
    },
    isLocal() {
      return this.$game.isLocal;
    },
    isLoggedIn() {
      return this.user && !this.user.isAnonymous;
    },
    user() {
      return this.$store.state.online.user;
    },
    isSpectator() {
      return !this.user || !this.$game.getPlayerFromUID(this.user.uid);
    },
    gameURL() {
      return this.$game.isLocal
        ? ""
        : this.$store.getters["ui/url"](this.$game) || "";
    },
  },
  methods: {
    copy(text) {
      this.$store.dispatch("ui/COPY", { text, title: "URL" });
    },
    qrCode(text) {
      this.$router.push({ name: "qr", params: { text } });
    },
  },
};
</script>
