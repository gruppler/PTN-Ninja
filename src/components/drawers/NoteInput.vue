<template>
  <div class="bg-ui column">
    <q-input
      ref="input"
      @keydown.enter="send"
      @keydown.esc="cancelEdit"
      debounce="50"
      class="footer-toolbar bg-ui text-primary col-grow q-pa-xs items-end note-input"
      v-model="message"
      :placeholder="$t('Note')"
      dense
      outlined
      autogrow
      color="primary"
      bg-color="primary"
      :dark="dark"
    />
    <q-btn-group spread stretch flat class="full-width">
      <q-btn
        v-if="editing"
        @click="cancelEdit"
        icon="close"
        :label="$t('Cancel')"
        color="primary"
        flat
      />
      <q-btn
        @click="send"
        :icon="editing ? 'save' : 'add_note'"
        :label="$t(editing ? 'Save' : 'Add Note')"
        :disabled="!isValid"
        :flat="!isValid"
        color="primary"
      />
    </q-btn-group>
  </div>
</template>

<script>
import { USER_NOTE_PREFIX } from "../../Game/PTN/Comment";

export default {
  name: "NoteInput",
  data() {
    return {
      message: "",
      editing: null,
    };
  },
  computed: {
    dark() {
      return this.$store.state.ui.theme.primaryDark;
    },
    currentPlyID() {
      const pos = this.$store.state.game.position;
      if (!pos.ply || (!pos.ply.index && !pos.plyIsDone)) {
        return -1;
      }
      return pos.plyID;
    },
    isValid() {
      return this.message.trim().length > 0;
    },
  },
  methods: {
    send(event) {
      if (event.shiftKey) {
        return;
      } else {
        event.preventDefault();
      }
      if (this.message) {
        if (this.editing) {
          this.$store.dispatch("game/EDIT_NOTE", {
            plyID: this.editing.plyID,
            index: this.editing.index,
            message:
              USER_NOTE_PREFIX + this.message.replace(/[{}]/g, "").trim(),
          });
          this.$emit("edited", {
            plyID: this.editing.plyID,
            index: this.editing.index,
          });
          this.editing = null;
        } else {
          this.$store.dispatch("game/ADD_NOTE", {
            message:
              USER_NOTE_PREFIX + this.message.replace(/[{}]/g, "").trim(),
          });
          this.$emit("added", { plyID: this.currentPlyID });
        }
        this.$refs.input.blur();
        this.message = "";
        this.$refs.input.focus();
      }
    },
    startEdit({ plyID, index, message }) {
      this.editing = { plyID, index };
      setTimeout(() => {
        this.$refs.input.focus();
        this.message = message.startsWith(USER_NOTE_PREFIX)
          ? message.slice(USER_NOTE_PREFIX.length)
          : message;
      }, 10);
    },
    cancelEdit() {
      if (this.editing) {
        this.editing = null;
        this.message = "";
      } else {
        this.$refs.input.blur();
      }
    },
    focus() {
      this.$refs.input.focus();
    },
    blur() {
      this.$refs.input.blur();
    },
  },
  watch: {
    "$store.state.game.name"() {
      this.cancelEdit();
    },
  },
};
</script>

<style lang="scss" scoped>
.note-input ::v-deep .q-field__native {
  max-height: 50vh;
}
</style>
