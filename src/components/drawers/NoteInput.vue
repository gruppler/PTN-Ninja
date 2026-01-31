<template>
  <div class="bg-ui row no-wrap">
    <q-input
      ref="input"
      @keydown.enter="send"
      @keydown.esc="cancelEdit"
      @blur="cancelEdit"
      debounce="50"
      class="footer-toolbar bg-ui text-primary col-grow q-pa-sm items-end"
      v-model="message"
      :placeholder="$t('Note')"
      dense
      rounded
      autogrow
      outlined
      color="primary"
      bg-color="primary"
      :dark="dark"
    >
      <template v-slot:append>
        <q-btn
          @click="send"
          :icon="editing ? 'edit' : 'add_note'"
          :disabled="!message.trim().length"
          flat
          dense
          round
        />
      </template>
    </q-input>
  </div>
</template>

<script>
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
            message: this.message.trim(),
          });
          this.$emit("edited", {
            plyID: this.editing.plyID,
            index: this.editing.index,
          });
          this.editing = null;
        } else {
          this.$store.dispatch("game/ADD_NOTE", {
            message: this.message.trim(),
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
        this.message = message;
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
};
</script>
