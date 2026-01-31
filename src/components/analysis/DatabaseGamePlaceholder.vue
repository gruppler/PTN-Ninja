<template>
  <div class="database-game-placeholder">
    <q-item class="q-pr-none q-py-none">
      <q-item-section class="q-py-sm">
        <q-item-label>
          <q-skeleton
            width="100%"
            height="1.15em"
            :animation="animation"
            :dark="dark"
            class="inline-block"
          />
        </q-item-label>
        <q-item-label>
          <q-skeleton
            width="100%"
            height="1.15em"
            :animation="animation"
            :dark="dark"
            class="inline-block"
          />
        </q-item-label>
        <q-item-label>
          <q-skeleton
            width="7em"
            height="1em"
            :animation="animation"
            :dark="dark"
            class="inline-block"
          />
        </q-item-label>
      </q-item-section>
      <q-item-section class="q-py-sm" side>
        <q-skeleton
          width="2.75em"
          height="2em"
          :animation="animation"
          :dark="dark"
          class="q-mx-xs"
        />
      </q-item-section>
      <q-item-section class="q-mr-md q-py-sm" side>
        <q-skeleton
          width="3.5em"
          height="2em"
          :animation="animation"
          :dark="dark"
        />
        <q-skeleton
          class="q-mt-xs"
          width="2em"
          height="1.15em"
          :animation="animation"
          :dark="dark"
        />
      </q-item-section>
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
    dark() {
      return this.$store.state.ui.theme.panelDark;
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
