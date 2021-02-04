<template>
  <large-dialog
    :value="true"
    no-backdrop-dismiss
    content-class="ptn-editor-dialog"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="edit">{{ $t("Edit PTN") }}</dialog-header>
    </template>

    <PTN-editor ref="editor" @save="save" />

    <template v-slot:footer>
      <q-card-actions align="right">
        <div class="col-grow error-message q-px-sm">
          {{ editor ? editor.error : "" }}
        </div>
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('OK')"
          @click="editor.save()"
          color="primary"
          :disabled="editor && !!editor.error"
          flat
        />
      </q-card-actions>
    </template>
  </large-dialog>
</template>

<script>
import PTNEditor from "../components/controls/PTNEditor.vue";

export default {
  name: "EditPTN",
  components: { PTNEditor },
  data() {
    return {
      showAll: false,
      editor: null,
    };
  },
  computed: {
    game() {
      return this.$game;
    },
  },
  methods: {
    close() {
      this.$router.back();
    },
    save(notation) {
      this.$store.dispatch("game/SET_CURRENT_PTN", notation);
      this.close();
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.editor = this.$refs.editor;
    });
  },
};
</script>

<style lang="scss">
.ptn-editor-dialog {
  .q-layout {
    > .absolute-full > .scroll {
      height: 100%;
    }
    &,
    .q-page-container {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      right: 0;
    }
  }

  .error-message {
    color: $negative;
    font-weight: bold;
  }
}
</style>
