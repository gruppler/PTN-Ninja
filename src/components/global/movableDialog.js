/**
 * Lets a dialog be moved by dragging its header. The position is never
 * stored: each time the dialog opens it starts in the center again.
 *
 * The component provides:
 *   maximized   a maximized dialog fills the screen and doesn't move
 *   moveTarget  a method returning the element to move, our own content
 *               inside Quasar's .q-dialog__inner, so the move never fights
 *               the open and close transitions Quasar runs on that one
 * and binds `moveHandle` (pointerdown) on its header and `resetMove`
 * (before-show) on the q-dialog.
 */

// Pointer travel before a press on the header becomes a drag, so a click
// with a shaky hand still clicks
const THRESHOLD = 4;
// How much of the dialog stays on screen, so its header can be grabbed again
const KEEP_VISIBLE = 64;
// Presses on these work as they would anywhere else
const INTERACTIVE =
  "button, a, input, textarea, select, .q-btn, .q-field, .q-tab, .q-toggle, .q-checkbox, [role='button'], [role='tab'], [tabindex]:not([tabindex='-1'])";

export default {
  data() {
    return { moveOffset: { x: 0, y: 0 }, isMoving: false };
  },
  computed: {
    isMovable() {
      return !this.maximized;
    },
    moveStyle() {
      const { x, y } = this.moveOffset;
      return x || y ? { transform: `translate(${x}px, ${y}px)` } : null;
    },
  },
  watch: {
    maximized(maximized) {
      if (maximized) {
        this.resetMove();
      }
    },
  },
  methods: {
    resetMove() {
      this.moveOffset = { x: 0, y: 0 };
    },
    moveHandle(event) {
      if (
        !this.isMovable ||
        event.button !== 0 ||
        event.pointerType === "touch" ||
        (event.target.closest && event.target.closest(INTERACTIVE))
      ) {
        return;
      }
      const target = this.moveTarget();
      if (!target) {
        return;
      }
      const handle = event.currentTarget;
      const start = { x: event.clientX, y: event.clientY };
      const origin = { ...this.moveOffset };
      const rect = target.getBoundingClientRect();
      // The rectangle at no offset, to clamp against
      const home = {
        left: rect.left - origin.x,
        top: rect.top - origin.y,
        width: rect.width,
        height: rect.height,
      };
      let dragging = false;

      const move = (moveEvent) => {
        const dx = moveEvent.clientX - start.x;
        const dy = moveEvent.clientY - start.y;
        if (!dragging) {
          if (Math.hypot(dx, dy) < THRESHOLD) {
            return;
          }
          dragging = true;
          this.isMoving = true;
          handle.setPointerCapture(event.pointerId);
        }
        moveEvent.preventDefault();
        const width = window.innerWidth;
        const height = window.innerHeight;
        const left = Math.min(
          Math.max(home.left + origin.x + dx, KEEP_VISIBLE - home.width),
          width - KEEP_VISIBLE
        );
        // The header, at the top, stays on screen
        const top = Math.min(
          Math.max(home.top + origin.y + dy, 0),
          height - KEEP_VISIBLE
        );
        this.moveOffset = { x: left - home.left, y: top - home.top };
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        if (dragging) {
          this.isMoving = false;
          if (handle.hasPointerCapture(event.pointerId)) {
            handle.releasePointerCapture(event.pointerId);
          }
          // Swallow the click that ends the drag
          const swallow = (clickEvent) => {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
          };
          handle.addEventListener("click", swallow, {
            capture: true,
            once: true,
          });
          setTimeout(
            () => handle.removeEventListener("click", swallow, true),
            0
          );
        }
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    },
  },
};
