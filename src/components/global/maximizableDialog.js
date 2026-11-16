/**
 * A Maximize button for a dialog's header (DialogHeader shows it).
 *
 * The component provides `autoMaximized`, whether the dialog fills the
 * screen on its own (a small screen), and binds `maximized` to its
 * q-dialog. The button switches to the other of the two; pressed again, it
 * goes back to following the screen. The choice is kept for each dialog,
 * by its component's name, or the `storageKey` prop.
 */

import {
  loadMaximizedPreference,
  saveMaximizedPreference,
} from "../../utils/dialogMaximizePreference";

export default {
  props: {
    storageKey: String,
  },
  provide() {
    return {
      dialogMaximized: () => this.maximized,
      toggleMaximized: this.toggleMaximized,
    };
  },
  data() {
    return {
      // null follows the screen, true or false is the user's choice
      maximizeOverride: loadMaximizedPreference(this.resolveStorageKey()),
    };
  },
  computed: {
    maximized() {
      return this.maximizeOverride !== null
        ? this.maximizeOverride
        : this.autoMaximized;
    },
  },
  methods: {
    resolveStorageKey() {
      return this.storageKey || (this.$parent && this.$parent.$options.name);
    },
    toggleMaximized() {
      this.maximizeOverride =
        this.maximizeOverride === null ? !this.autoMaximized : null;
      saveMaximizedPreference(this.resolveStorageKey(), this.maximizeOverride);
    },
  },
};
