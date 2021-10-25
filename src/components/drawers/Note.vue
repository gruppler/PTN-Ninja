<template>
  <q-chat-message
    :id="`message-${plyID}-${index}`"
    bg-color="primary"
    :text-color="primaryDark ? 'textLight' : 'textDark'"
    text-sanitize
    sent
  >
    <span>{{ comment.message }}</span>
    <template v-slot:stamp>
      <q-menu
        context-menu
        auto-close
        transition-show="none"
        transition-hide="none"
        :target="`#message-${plyID}-${index} > div > div`"
      >
        <q-list>
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
    </template>
  </q-chat-message>
</template>

<script>
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
};
</script>
