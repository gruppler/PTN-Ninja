import DialogHeader from "../components/global/DialogHeader";
import Hint from "../components/global/Hint";
import LargeDialog from "../components/global/LargeDialog";
import MessageOutput from "../components/global/MessageOutput";
import Recess from "../components/global/Recess";
import RelativeDate from "../components/global/RelativeDate";
import RelativeTime from "../components/global/RelativeTime";
import SmallDialog from "../components/global/SmallDialog";
import SmoothReflow from "../components/global/SmoothReflow";
import Tooltip from "../components/global/Tooltip";

export default ({ Vue }) => {
  Vue.component("dialog-header", DialogHeader);
  Vue.component("hint", Hint);
  Vue.component("large-dialog", LargeDialog);
  Vue.component("message-output", MessageOutput);
  Vue.component("recess", Recess);
  Vue.component("relative-date", RelativeDate);
  Vue.component("relative-time", RelativeTime);
  Vue.component("small-dialog", SmallDialog);
  Vue.component("smooth-reflow", SmoothReflow);
  Vue.component("tooltip", Tooltip);
};
