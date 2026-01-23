<template>
  <div class="analysis-item-placeholder">
    <q-item style="height: 60px">
      <q-item-section>
        <q-item-label class="q-pa-xs">
          <q-skeleton width="3em" height="2em" :animation="animation" />
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-item-label class="q-px-xs">
          <q-skeleton width="5em" height="1.5em" :animation="animation" />
        </q-item-label>
        <q-item-label class="q-px-xs">
          <q-skeleton width="5em" height="1.3em" :animation="animation" />
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item v-if="showContinuation" class="q-pt-none">
      <q-item-section style="justify-content: start">
        <q-item-label class="q-pa-xs">
          <q-skeleton width="100%" height="1.5em" :animation="animation" />
        </q-item-label>
      </q-item-section>
    </q-item>
  </div>
</template>

<script>
export default {
  name: "AnalysisItemPlaceholder",
  props: {
    static: {
      type: Boolean,
      default: false,
    },
    showContinuation: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    animation() {
      return this.static ? "none" : "wave";
    },
  },
};
</script>

<style lang="scss">
.analysis-item,
.analysis-item-placeholder {
  + .analysis-item-placeholder {
    border-top: 1px solid rgba($separator-color, 0.1);
    body.panelDark & {
      border-top-color: rgba($separator-dark-color, 0.1);
    }
  }
}
</style>
