<script>
import { defaults, isEqual, omit } from "lodash";

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
      previous: null,
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
    format() {
      this.previous = this.notifications.map(n => omit(n, "actions"));
      return this.notifications.reverse().map(notification => {
        const color = notification.textColor || this.textColor;
        if (notification.classes) {
          notification.classes += " text-" + color;
        } else {
          notification.classes = "text-" + color;
        }
        if (notification.actions) {
          notification.actions = notification.actions.map(action =>
            defaults(action, { color })
          );
        }
        this.default.actions = this.default.actions.map(action => ({
          ...action,
          color
        }));
        return this;
      });
    },
    show() {
      this.closers = this.notifications.map(notification => {
        return this.$q.notify(defaults(notification, this.default));
      });
    },
    hide() {
      this.closers.forEach(close => close());
      this.closers = [];
    }
  },
  watch: {
    notifications(current) {
      current = current.map(n => omit(n, "actions"));
      if (!isEqual(current, this.previous)) {
        this.format();
        this.hide();
        this.show();
      }
    }
  },
  created() {
    this.format();
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
