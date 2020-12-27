import DialogHeader from "../components/global/DialogHeader";
import LargeDialog from "../components/global/LargeDialog";
import MessageOutput from "../components/global/MessageOutput";
import Recess from "../components/global/Recess";
import SmallDialog from "../components/global/SmallDialog";
import SmoothReflow from "../components/global/SmoothReflow";

export default ({ Vue }) => {
  Vue.component("dialog-header", DialogHeader);
  Vue.component("large-dialog", LargeDialog);
  Vue.component("message-output", MessageOutput);
  Vue.component("recess", Recess);
  Vue.component("small-dialog", SmallDialog);
  Vue.component("smooth-reflow", SmoothReflow);
};
