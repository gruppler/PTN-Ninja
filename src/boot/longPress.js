// Synthesize contextmenu events from long-press on touch devices
// where native right-click is unavailable (e.g., iOS Safari).
// Vue 2's @click.right compiles to a contextmenu listener, so all
// existing @click.right.prevent handlers automatically benefit.

const LONG_PRESS_DURATION = 300; // ms
const MOVE_THRESHOLD = 10; // px

let timer = null;
let startX = 0;
let startY = 0;
let longPressFired = false;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function onTouchStart(e) {
  if (e.touches.length !== 1) {
    clearTimer();
    return;
  }

  const touch = e.touches[0];
  startX = touch.clientX;
  startY = touch.clientY;
  longPressFired = false;

  clearTimer();
  timer = setTimeout(() => {
    timer = null;
    longPressFired = true;

    const target =
      document.elementFromPoint(touch.clientX, touch.clientY) || e.target;
    target.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: touch.clientX,
        clientY: touch.clientY,
        screenX: touch.screenX,
        screenY: touch.screenY,
      })
    );
  }, LONG_PRESS_DURATION);
}

function onTouchMove(e) {
  if (!timer) return;
  const touch = e.touches[0];
  if (
    Math.abs(touch.clientX - startX) > MOVE_THRESHOLD ||
    Math.abs(touch.clientY - startY) > MOVE_THRESHOLD
  ) {
    clearTimer();
  }
}

function onTouchEnd() {
  clearTimer();
}

function onNativeContextMenu() {
  // Native contextmenu already fired (e.g., Android long-press);
  // cancel our synthetic dispatch but still suppress the subsequent click.
  if (timer) {
    clearTimer();
    longPressFired = true;
  }
}

function onClick(e) {
  if (longPressFired) {
    e.stopPropagation();
    e.preventDefault();
    longPressFired = false;
  }
}

export default () => {
  if (!("ontouchstart" in window) && !(navigator.maxTouchPoints > 0)) {
    return;
  }

  document.addEventListener("touchstart", onTouchStart, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchmove", onTouchMove, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchend", onTouchEnd, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchcancel", onTouchEnd, {
    capture: true,
    passive: true,
  });
  document.addEventListener("contextmenu", onNativeContextMenu, {
    capture: true,
  });
  document.addEventListener("click", onClick, { capture: true });
};
