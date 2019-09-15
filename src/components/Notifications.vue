<script>
import { defaults } from "lodash";

export default {
  name: "Notifications",
  props: {
    notifications: Array,
    color: {
      type: String,
      default: "primary"
    },
    "text-color": {
      type: String,
      default: "grey-10"
    }
  },
  data() {
    return {
      closers: [],
      default: {
        color: this.color,
        position: "top-right",
        actions: [{ icon: "close" }],
        classes: "text-" + this.textColor,
        timeout: 0
      }
    };
  },
  methods: {
    show() {
      this.closers = this.notifications
        .concat()
        .reverse()
        .map(notification => {
          const color = notification.textColor || this.textColor;
          notification.classes += " text-" + color;
          if (notification.actions) {
            notification.actions = notification.actions.map(action =>
              defaults(action, { color })
            );
          }
          this.default.actions = this.default.actions.map(action => ({
            ...action,
            color
          }));
          return this.$q.notify(defaults(notification, this.default));
        });
    },
    hide() {
      this.closers.forEach(close => close());
      this.closers = [];
    }
  },
  watch: {
    notifications() {
      this.hide();
      this.show();
    }
  },
  created() {
    this.show();
  },
  beforeDestroy() {
    this.hide();
  },
  render() {
    return null;
  }
};
</script>
