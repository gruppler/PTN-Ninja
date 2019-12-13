<template>
  <q-dialog :value="value" @input="$emit('input', $event)">
    <q-card style="width: 600px" class="bg-secondary">
      <q-tabs v-model="section" active-color="accent" indicator-color="accent">
        <q-tab name="about" icon="info" :label="$t('About')" />
        <q-tab name="usage" icon="help" :label="$t('Usage')" />
        <q-tab name="hotkeys" icon="keyboard" :label="$t('Hotkeys')" />
      </q-tabs>

      <SmoothReflow class="col">
        <Recess>
          <div
            ref="content"
            class="help scroll"
            style="max-height: calc(100vh - 18.5rem)"
          >
            <q-tab-panels
              v-model="section"
              class="bg-secondary col-grow"
              swipeable
              animated
            >
              <q-tab-panel name="about">
                <q-markdown :src="about" />
              </q-tab-panel>

              <q-tab-panel name="usage">
                <q-markdown :src="usage" />
              </q-tab-panel>

              <q-tab-panel name="hotkeys">
                <hotkeys />
              </q-tab-panel>
            </q-tab-panels>
          </div>
        </Recess>
      </SmoothReflow>

      <q-separator />

      <q-card-actions align="right">
        <q-btn :label="$t('Close')" color="accent" flat v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import about from "../../i18n/en-us/about.md";
import usage from "../../i18n/en-us/usage.md";
import hotkeys from "../../i18n/hotkeys.vue";

export default {
  name: "Help",
  components: { hotkeys },
  props: ["value"],
  data() {
    return {
      section: "about",
      about,
      usage
    };
  },
  watch: {
    section() {
      this.$nextTick(() => {
        this.$refs.content.scrollTop = 0;
      });
    }
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
</style>
