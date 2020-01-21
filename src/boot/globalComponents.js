import DialogHeader from "../components/global/DialogHeader";
import LargeDialog from "../components/global/LargeDialog";
import MessageOutput from "../components/global/MessageOutput";
import Recess from "../components/global/Recess";
import SmoothReflow from "../components/global/SmoothReflow";

export default ({ Vue }) => {
  Vue.component("dialog-header", DialogHeader);
  Vue.component("large-dialog", LargeDialog);
  Vue.component("message-output", MessageOutput);
  Vue.component("recess", Recess);
  Vue.component("smooth-reflow", SmoothReflow);
};
