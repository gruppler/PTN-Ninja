importScripts("./tiltak_wasm.js");

const { is_tak } = wasm_bindgen;

// Buffer messages that arrive before wasm is ready
const pending = [];
let ready = false;

self.onmessage = ({ data }) => {
  if (ready) {
    handleMessage(data);
  } else {
    pending.push(data);
  }
};

function handleMessage({ tps, size }) {
  try {
    const tak = is_tak(tps, size);
    self.postMessage({ tak });
  } catch (e) {
    self.postMessage({ error: String(e) });
  }
}

wasm_bindgen("./tiltak_wasm_bg.wasm").then(() => {
  ready = true;
  self.postMessage({ ready: true });
  for (const data of pending) {
    handleMessage(data);
  }
  pending.length = 0;
});
