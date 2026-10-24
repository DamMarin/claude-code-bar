// Escape sequences first, while their ESC is still there to match on: CSI (colors, cursor)
// and OSC (window title, links). Then any control character left over.
const CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const OSC = /\x1b\][^\x07\x1b]*(\x07|\x1b\\)?/g;
const CONTROL = /[\x00-\x1f\x7f-\x9f]/g;

// Text from outside (a branch, folder or model name) made safe to print in a terminal
export function stripControl(text) {
  return text.replace(CSI, "").replace(OSC, "").replace(CONTROL, "");
}
