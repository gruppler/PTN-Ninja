<template>
  <q-dialog
    ref="dialog"
    :content-class="['small-dialog', 'non-selectable', $attrs['content-class']]"
    :value.sync="value"
    @hide="hide"
    v-on="$listeners"
    v-bind="$attrs"
  >
    <div class="dialog-content column no-wrap bg-ui">
      <header class="bg-accent">
        <slot name="header" />
      </header>

      <slot />

      <footer class="bg-accent">
        <slot name="footer" />
      </footer>
    </div>
  </q-dialog>
</template>

<script>
export default {
  name: "small-dialog",
  props: {
    value: Boolean,
  },
  methods: {
    hide() {
      this.$router.back();
    },
  },
};
</script>

<style lang="scss">
.small-dialog {
  header,
  footer {
    position: sticky;
    z-index: 1;
  }
  header {
    top: 0;
    box-shadow: $shadow-3;
  }
  footer {
    bottom: -0.5px;
    box-shadow: $shadow-up-3;
  }
  .dialog-content,
  footer {
    color: $dark;
    background-color: #fff;
    body.body--dark & {
      color: #fff;
      background-color: $dark;
    }
  }
}
</style>
