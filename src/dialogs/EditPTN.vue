<template>
  <large-dialog
    ref="dialog"
    :value="true"
    no-backdrop-dismiss
    content-class="ptn-editor-dialog"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="edit">{{ $t("Edit PTN") }}</dialog-header>
    </template>

    <PTN-editor ref="editor" @save="save" @hasChanges="hasChanges = $event" />

    <template v-slot:footer>
      <q-card-actions align="right">
        <q-btn icon="menu_vertical" flat>
          <q-menu
            transition-show="none"
            transition-hide="none"
            auto-close
            square
          >
            <q-list>
              <q-item clickable @click="reset">
                <q-item-section side>
                  <q-icon name="undo" />
                </q-item-section>
                <q-item-section>{{ $t("Reset") }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
        <div class="col-grow error-message q-px-sm">
          {{ editor ? editor.error : "" }}
        </div>
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t('Save')"
          @click="editor.save()"
          :disabled="editor && !!editor.error"
          :flat="!hasChanges"
          color="primary"
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
      hasChanges: false,
    };
  },
  computed: {
    game() {
      return this.$game;
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    reset() {
      this.editor.reset();
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
