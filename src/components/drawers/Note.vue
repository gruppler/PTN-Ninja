<template>
  <q-chat-message
    bg-color="primary"
    :text-color="primaryDark ? 'textLight' : 'textDark'"
    text-sanitize
    sent
  >
    <span>
      <q-btn
        class="note-menu-btn float-right"
        style="margin-top: -8px; margin-right: -8px"
        icon="menu_vertical"
        dense
        flat
      >
        <q-menu auto-close transition-show="none" transition-hide="none">
          <q-list>
            <q-item @click="copy" clickable>
              <q-item-section side>
                <q-icon name="copy" />
              </q-item-section>
              <q-item-section>{{ $t("Copy") }}</q-item-section>
            </q-item>
            <q-item @click="$emit('edit', { plyID, index })" clickable>
              <q-item-section side>
                <q-icon name="edit" />
              </q-item-section>
              <q-item-section>{{ $t("Edit") }}</q-item-section>
            </q-item>
            <q-item @click="$emit('remove', { plyID, index })" clickable>
              <q-item-section side>
                <q-icon name="delete" />
              </q-item-section>
              <q-item-section>{{ $t("Delete") }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
      <span
        v-if="comment.isUserNote"
        v-html="renderMarkdown(comment.displayMessage)"
      />
      <span v-else>{{ comment.message }}</span>
    </span>
  </q-chat-message>
</template>

<script>
import inlineMarkdown from "../../utils/inlineMarkdown";

export default {
  name: "Note",
  props: ["plyID", "index", "comment"],
  data() {
    return {
      message: "",
      editing: null,
    };
  },
  computed: {
    primaryDark() {
      return this.$store.state.ui.theme.primaryDark;
    },
  },
  methods: {
    copy() {
      this.$store.dispatch("ui/COPY", {
        text: this.comment.displayMessage,
      });
    },
    renderMarkdown(text) {
      return inlineMarkdown(text);
    },
  },
};
</script>
