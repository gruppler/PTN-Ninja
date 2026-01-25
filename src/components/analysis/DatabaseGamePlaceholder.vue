<template>
  <div class="database-game-placeholder">
    <q-item class="q-pr-none q-py-none">
      <q-item-section class="q-py-sm">
        <q-item-label>
          <q-icon name="player1" left class="invisible" />
          <q-skeleton
            width="8em"
            height="1.15em"
            :animation="animation"
            class="inline-block"
          />
        </q-item-label>
        <q-item-label>
          <q-icon name="player2" left class="invisible" />
          <q-skeleton
            width="7em"
            height="1.15em"
            :animation="animation"
            class="inline-block"
          />
        </q-item-label>
        <q-item-label>
          <span class="q-px-md" />
          <q-skeleton
            width="5em"
            height="1em"
            :animation="animation"
            class="inline-block"
          />
        </q-item-label>
      </q-item-section>
      <q-item-section class="q-mr-md q-py-sm" side>
        <q-skeleton width="2.5em" height="1.5em" :animation="animation" />
        <q-skeleton
          class="q-mt-xs"
          width="2em"
          height="1.15em"
          :animation="animation"
        />
      </q-item-section>
      <q-separator vertical />
      <div style="width: 56px" />
    </q-item>
  </div>
</template>

<script>
export default {
  name: "DatabaseGamePlaceholder",
  props: {
    static: {
      type: Boolean,
      default: false,
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
.database-game,
.database-game-placeholder {
  + .database-game-placeholder {
    border-top: 1px solid rgba($separator-color, 0.1);
    body.panelDark & {
      border-top-color: rgba($separator-dark-color, 0.1);
    }
  }
}
</style>
