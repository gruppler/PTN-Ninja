<template>
  <q-dialog :value="value" @input="$emit('input', $event)">
    <q-card style="width: 600px" class="bg-secondary">
      <DialogHeader>{{ $t("Help") }}</DialogHeader>

      <q-separator />

      <div class="row no-wrap">
        <q-tabs
          v-model="section"
          active-color="accent"
          indicator-color="accent"
          vertical
          no-caps
        >
          <q-tab name="about" icon="info" :label="$t('About')" />
          <q-tab name="usage" icon="help" :label="$t('Usage')" />
          <q-tab name="hotkeys" icon="keyboard" :label="$t('Hotkeys')" />
        </q-tabs>

        <q-separator vertical />

        <Recess class="col">
          <div
            ref="content"
            class="scroll"
            style="max-height: calc(100vh - 22rem)"
          >
            <q-tab-panels
              v-model="section"
              class="bg-secondary col-grow"
              transition-prev="jump-down"
              transition-next="jump-up"
              animated
            >
              <q-tab-panel name="about">
                <vue-markdown>{{ $t("docs.about") }}</vue-markdown>
              </q-tab-panel>

              <q-tab-panel name="usage">
                <vue-markdown>{{ $t("docs.usage") }}</vue-markdown>
              </q-tab-panel>

              <q-tab-panel name="hotkeys">
                <vue-markdown>{{ $t("docs.hotkeys") }}</vue-markdown>
              </q-tab-panel>
            </q-tab-panels>
          </div>
        </Recess>
      </div>

      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import DialogHeader from "../general/DialogHeader";

import VueMarkdown from "vue-markdown";

import { HOTKEYS_FORMATTED } from "../../keymap";

export default {
  name: "Help",
  components: { DialogHeader, VueMarkdown },
  props: ["value"],
  data() {
    return {
      section: "about",
      hotkeys: HOTKEYS_FORMATTED
    };
  },
  watch: {
    section() {
      this.$refs.content.scrollTop = 0;
    }
  }
};
</script>

<style></style>
