<script>
import { cloneDeep, defaults, isEqual, omit } from "lodash";

export default {
  name: "Notifications",
  props: {
    notifications: Array,
    color: {
      type: String,
      default: "primary",
    },
    "text-color": {
      type: String,
      default: "grey-10",
    },
  },
  data() {
    return {
      n: null,
      closers: [],
      previous: null,
      isFormatted: false,
      default: {
        color: this.color,
        position: "top-right",
        actions: [{ icon: "close" }],
        classes: "text-" + this.textColor,
        timeout: 0,
      },
    };
  },
  methods: {
    format() {
      if (this.isFormatted) {
        return;
      }
      this.previous = this.notifications.map((n) => omit(n, "actions"));
      this.isFormatted = true;
      this.n = cloneDeep(this.notifications);
      return this.n.reverse().map((notification) => {
        const color = notification.textColor || this.textColor;
        if (notification.classes) {
          notification.classes += " text-" + color;
        } else {
          notification.classes = "text-" + color;
        }
        if (notification.actions) {
          notification.actions = notification.actions.map((action) =>
            defaults(action, { color })
          );
        }
        this.default.actions = this.default.actions.map((action) => ({
          ...action,
          color,
        }));
        return this;
      });
    },
    show() {
      this.closers = this.n.map((notification) => {
        return this.$q.notify(defaults(notification, this.default));
      });
    },
    hide() {
      this.closers.forEach((close) => close());
      this.closers = [];
    },
  },
  watch: {
    notifications(current) {
      this.isFormatted = false;
      current = current.map((n) => omit(n, "actions"));
      if (!isEqual(current, this.previous)) {
        this.format();
        this.hide();
        this.show();
      }
    },
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
  },
};
</script>
