<template>
  <div class="column">
    <q-input
      ref="input"
      @keydown.enter="send"
      @keydown.esc="cancelEdit"
      @keydown="onFormatKey"
      @paste="onPaste"
      debounce="50"
      class="footer-toolbar text-primary col-grow q-pa-xs items-end note-input"
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
        :icon="editing ? 'save_edit' : 'add_note'"
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
    onFormatKey(event) {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;
      const key = event.key && event.key.toLowerCase();
      if (event.shiftKey) {
        if (key === "x") {
          event.preventDefault();
          this.wrapSelection(event.target, "~~", "~~");
        }
        return;
      }
      const formatMap = {
        b: ["**", "**"],
        i: ["*", "*"],
        u: ["__", "__"],
        e: ["`", "`"],
      };
      const fmt = formatMap[key];
      if (!fmt) return;
      event.preventDefault();
      this.wrapSelection(event.target, fmt[0], fmt[1]);
    },
    onPaste(event) {
      const el = event.target;
      if (!el || typeof el.selectionStart !== "number") return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (start === end) return;
      const clipboard = event.clipboardData || window.clipboardData;
      const clipText = clipboard && clipboard.getData("text");
      if (!clipText) return;
      const url = clipText.trim();
      if (!/^https?:\/\/\S+$/.test(url)) return;
      event.preventDefault();
      const selected = el.value.substring(start, end);
      this.replaceSelection(el, "[" + selected + "](" + url + ")");
    },
    wrapSelection(el, prefix, suffix) {
      if (!el || typeof el.selectionStart !== "number") return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const selected = val.substring(start, end);
      let newValue, selStart, selEnd;
      if (selected) {
        newValue =
          val.substring(0, start) +
          prefix +
          selected +
          suffix +
          val.substring(end);
        selStart = start + prefix.length;
        selEnd = selStart + selected.length;
      } else {
        newValue =
          val.substring(0, start) + prefix + suffix + val.substring(end);
        selStart = selEnd = start + prefix.length;
      }
      this.message = newValue;
      this.$nextTick(() => {
        try {
          el.setSelectionRange(selStart, selEnd);
        } catch (e) {
          // ignore
        }
        el.focus();
      });
    },
    replaceSelection(el, replacement) {
      if (!el || typeof el.selectionStart !== "number") return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      this.message = val.substring(0, start) + replacement + val.substring(end);
      const cursorPos = start + replacement.length;
      this.$nextTick(() => {
        try {
          el.setSelectionRange(cursorPos, cursorPos);
        } catch (e) {
          // ignore
        }
        el.focus();
      });
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
