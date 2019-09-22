<template>
  <q-btn @click="copy" icon="file_copy" :title="$t('Copy to Clipboard')" />
</template>

<script>
export default {
  name: "CopyButton",
  props: ["game"],
  methods: {
    copy() {
      const el = document.createElement("textarea");
      el.value = this.game.ptn;
      el.setAttribute("readonly", "");
      el.style = { position: "absolute", left: "-9999px" };
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
  }
};
</script>

<style lang="stylus"></style>
