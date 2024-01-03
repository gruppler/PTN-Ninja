<template>
  <large-dialog
    ref="dialog"
    v-model="model"
    no-backdrop-dismiss
    content-class="ptn-editor-dialog"
    v-bind="$attrs"
  >
    <template v-slot:header>
      <dialog-header icon="edit">{{
        $t(isNewGame ? "New Game" : "Edit PTN")
      }}</dialog-header>
    </template>

    <PTN-editor
      ref="editor"
      :value="ptn"
      @save="save"
      @hasChanges="hasChanges = $event"
      @error="error = $event"
      :is-new-game="isNewGame"
    />

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
              <q-item clickable @click="showHeader = !showHeader">
                <q-item-section side>
                  <q-icon name="header" />
                </q-item-section>
                <q-item-section>{{
                  $t(showHeader ? "Hide Header Tags" : "Show Header Tags")
                }}</q-item-section>
              </q-item>
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
          {{ error }}
        </div>
        <q-btn :label="$t('Cancel')" color="primary" flat v-close-popup />
        <q-btn
          :label="$t(isNewGame ? 'OK' : 'Save')"
          @click="$refs.editor.save()"
          :disabled="Boolean(error)"
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
  props: ["value", "ptn"],
  data() {
    return {
      error: "",
      hasChanges: false,
    };
  },
  computed: {
    model: {
      get() {
        return !this.isNewGame || this.value;
      },
      set(value) {
        this.$emit("input", value);
        if (!value) {
          this.close();
        }
      },
    },
    showHeader: {
      get() {
        return this.$store.state.ui.editHeader;
      },
      set(value) {
        this.$store.dispatch("ui/SET_UI", ["editHeader", Boolean(value)]);
      },
    },
    isNewGame() {
      return this.$route.name === "add";
    },
  },
  methods: {
    close() {
      this.$refs.dialog.hide();
    },
    reset() {
      this.$refs.editor.reset();
    },
    save(notation) {
      if (this.isNewGame) {
        this.$emit("submit", notation);
      } else {
        this.$store.dispatch("game/SET_CURRENT_PTN", notation);
      }
      this.close();
    },
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
