<template>
  <div class="analysis-item">
    <q-item style="height: 60px">
      <q-item-section>
        <q-item-label class="q-pa-xs">
          <q-skeleton width="3em" height="2em" />
        </q-item-label>
      </q-item-section>
      <q-item-section side>
        <q-item-label class="q-px-xs">
          <q-skeleton width="5em" height="1.5em" />
        </q-item-label>
        <q-item-label class="q-px-xs">
          <q-skeleton width="5em" height="1.3em" />
        </q-item-label>
      </q-item-section>
    </q-item>
    <q-item class="q-pt-none">
      <q-item-section style="justify-content: start">
        <q-item-label class="q-pa-xs">
          <q-skeleton width="100%" height="1.5em" />
        </q-item-label>
      </q-item-section>
    </q-item>
  </div>
</template>

<script>
export default {
  name: "AnalysisItemPlaceholder",
};
</script>
