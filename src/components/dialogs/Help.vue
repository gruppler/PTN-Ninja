<template>
  <LargeDialog :value="value" @input="$emit('input', $event)">
    <template v-slot:header>
      <q-tabs v-model="section" active-color="accent" indicator-color="accent">
        <q-tab name="about" icon="info" :label="$t('About')" />
        <q-tab name="usage" icon="help" :label="$t('Usage')" />
        <q-tab name="hotkeys" icon="keyboard" :label="$t('Hotkeys')" />
      </q-tabs>
    </template>

    <div class="help">
      <q-tab-panels v-model="section" class="bg-secondary col-grow" animated>
        <q-tab-panel name="about">
          <q-markdown ref="about" :src="about" />
        </q-tab-panel>

        <q-tab-panel name="usage">
          <q-markdown ref="usage" :src="usage" />
        </q-tab-panel>

        <q-tab-panel name="hotkeys">
          <q-markdown ref="hotkeys">{{ $t("Hotkeys") + "\n===" }}</q-markdown>
          <hotkeys />
        </q-tab-panel>
      </q-tab-panels>
    </div>

    <template v-slot:footer>
      <q-separator />
      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </template>

    <q-page-scroller position="top" />
  </LargeDialog>
</template>

<script>
import LargeDialog from "../general/LargeDialog.vue";

import hotkeys from "../../i18n/hotkeys.vue";

export default {
  name: "Help",
  components: { LargeDialog, hotkeys },
  props: ["value"],
  data() {
    return {
      section: "about",
      about: "",
      usage: ""
    };
  },
  watch: {
    section(section) {
      this.$nextTick(() => {
        this.$refs[section].$el.scrollIntoView(true);
      });
    }
  },
  created() {
    import(`../../i18n/${this.$i18n.locale}/about.md`)
      .then(about => {
        this.about = about.default;
      })
      .catch(error => {
        console.log(error);
        import(`../../i18n/${this.$i18n.fallbackLocale}/about.md`).then(
          about => {
            this.about = about.default;
          }
        );
      });
    import(`../../i18n/${this.$i18n.locale}/usage.md`)
      .then(usage => {
        this.usage = usage.default;
      })
      .catch(error => {
        console.log(error);
        import(`../../i18n/${this.$i18n.fallbackLocale}/usage.md`).then(
          usage => {
            this.usage = usage.default;
          }
        );
      });
  }
};
</script>

<style lang="stylus">
.help
  h6
    margin-top 0
    margin-bottom 1em
    ~ h6
      margin-top 1.5em

.body--dark .q-markdown
  .q-markdown--link
    color: $accent

    &:hover
      color: darken($accent, 10%)
</style>
