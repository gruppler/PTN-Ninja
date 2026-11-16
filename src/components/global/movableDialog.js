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
 *
 * A dialog is moved only as far as keeps all of it on screen, and a moved
 * one is kept there as it changes size: Quasar keeps a dialog centered, so
 * one that grows (More in Edit Game) grows up as well as down, and one moved
 * to the top would lose its header above the window.
 */

// Pointer travel before a press on the header becomes a drag, so a click
// with a shaky hand still clicks
const THRESHOLD = 4;

// Where a dialog's left or top edge may go, along one axis: anywhere that
// keeps all of it in view, or the start, header first, when it doesn't fit
const onScreen = (start, size, view) =>
  Math.max(0, Math.min(start, view - size));
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
    // Watch the size only while the dialog is away from the center, where
    // Quasar's own centering can't push it off screen
    moveOffset({ x, y }) {
      if (x || y) {
        this.watchSize();
      } else {
        this.unwatchSize();
      }
    },
  },
  beforeDestroy() {
    this.unwatchSize();
  },
  methods: {
    resetMove() {
      this.moveOffset = { x: 0, y: 0 };
    },
    watchSize() {
      if (this.sizeObserver) {
        return;
      }
      const target = this.moveTarget();
      if (!target || typeof ResizeObserver === "undefined") {
        return;
      }
      this.sizeObserver = new ResizeObserver(() => this.keepOnScreen());
      this.sizeObserver.observe(target);
      window.addEventListener("resize", this.keepOnScreen);
    },
    unwatchSize() {
      if (this.sizeObserver) {
        this.sizeObserver.disconnect();
        this.sizeObserver = null;
        window.removeEventListener("resize", this.keepOnScreen);
      }
    },
    // Shift a moved dialog back on screen
    keepOnScreen() {
      const target = this.moveTarget();
      if (this.isMoving || !target) {
        return;
      }
      const rect = target.getBoundingClientRect();
      const dx = onScreen(rect.left, rect.width, window.innerWidth) - rect.left;
      const dy = onScreen(rect.top, rect.height, window.innerHeight) - rect.top;
      if (dx || dy) {
        this.moveOffset = {
          x: this.moveOffset.x + dx,
          y: this.moveOffset.y + dy,
        };
      }
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

      // On the window rather than the header: the first move can already be
      // outside it, before the pointer is captured, when the drag starts
      // fast or near the header's edge
      const move = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) {
          return;
        }
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
        const left = onScreen(
          home.left + origin.x + dx,
          home.width,
          window.innerWidth
        );
        const top = onScreen(
          home.top + origin.y + dy,
          home.height,
          window.innerHeight
        );
        this.moveOffset = { x: left - home.left, y: top - home.top };
      };
      const end = (endEvent) => {
        if (endEvent.pointerId !== event.pointerId) {
          return;
        }
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        if (dragging) {
          this.isMoving = false;
          if (handle.hasPointerCapture(event.pointerId)) {
            handle.releasePointerCapture(event.pointerId);
          }
          // Swallow the click that ends the drag, wherever it lands: on the
          // backdrop, it would close the dialog
          const swallow = (clickEvent) => {
            clickEvent.stopPropagation();
            clickEvent.preventDefault();
          };
          window.addEventListener("click", swallow, {
            capture: true,
            once: true,
          });
          setTimeout(
            () => window.removeEventListener("click", swallow, true),
            0
          );
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
  },
};
