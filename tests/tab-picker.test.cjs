const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../content.js"), "utf8");

function setup(send = async (message) => message.type === "navbro.tab.list" ? { tabs: [
  { id: 1, title: "Current", url: "https://one.test", active: true },
  { id: 2, title: "Other", url: "https://two.test" },
  { id: 3, title: "Third", url: "https://three.test" },
] } : { ok: true }) {
  const document = { activeElement: null };
  function element() {
    return {
      style: {}, children: [], value: "", hidden: false, isConnected: true,
      setAttribute(name, value) { this[name] = value; },
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.append(child); },
      replaceChildren() { this.children = []; this.textContent = ""; },
      addEventListener(name, callback) { this[name] = callback; },
      focus() { document.activeElement = this; },
      scrollIntoView(options) { this.lastScroll = options; },
      remove() { this.isConnected = false; },
    };
  }
  document.createElement = element;
  document.body = element();
  const previousFocus = element();
  previousFocus.focus();
  const messages = [];
  const toasts = [];
  const context = vm.createContext({ document, send: (message) => { messages.push(message); return send(message); }, toasts });
  const helpers = source.slice(source.indexOf("  const closeTabPicker ="), source.indexOf("  const closeTabWindowPicker ="));
  vm.runInContext(`const STATE = { tabPickerSession: null }; const sendRuntimeMessageWithResponse = send; const showToast = message => toasts.push(message); ${helpers}; globalThis.api = { STATE, startTabPicker, closeTabPicker, handleTabPickerInput };`, context);
  return { ...context.api, document, previousFocus, messages, toasts };
}
function key(api, value, options = {}) {
  const event = { key: value, prevented: false, stopped: false, ...options,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  api.handleTabPickerInput(event);
  return event;
}

test("picker lists current window tabs, selects and jumps", async () => {
  const api = setup();
  await api.startTabPicker();
  const session = api.STATE.tabPickerSession;
  assert.equal(session.list.children.length, 3);
  assert.equal(api.document.activeElement, session.dialog);
  assert.equal(session.list.children[0]["aria-selected"], "true");
  assert.equal(key(api, "j").prevented, true);
  assert.equal(session.selectedIndex, 1);
  key(api, "ArrowUp");
  assert.equal(session.selectedIndex, 0);
  key(api, "k");
  assert.equal(session.selectedIndex, 2);
  assert.equal(session.list.children[2].lastScroll.block, "nearest");
  key(api, "Enter");
  await Promise.resolve();
  assert.equal(api.messages[1].type, "navbro.tab.jump");
  assert.equal(api.messages[1].tabId, 3);
  assert.equal(api.STATE.tabPickerSession, null);
  assert.equal(api.document.activeElement, api.previousFocus);
});

test("slash searches title and URL; typing is isolated, arrows and Enter still work", async () => {
  const api = setup();
  await api.startTabPicker();
  const session = api.STATE.tabPickerSession;
  key(api, "/");
  assert.equal(session.search.hidden, false);
  assert.equal(api.document.activeElement, session.search);
  const typing = key(api, "j");
  assert.equal(typing.stopped, true);
  assert.equal(typing.prevented, false);
  assert.equal(session.selectedIndex, 0);
  assert.equal(key(api, "Enter", { isComposing: true }).prevented, false);
  assert.equal(api.messages.length, 1);
  session.search.value = "TWO.TEST";
  session.search.input();
  assert.equal(session.filtered.length, 1);
  assert.equal(session.filtered[0].id, 2);
  session.search.value = "missing";
  session.search.input();
  assert.equal(session.list.textContent, "No matching tabs.");
  key(api, "ArrowDown");
  key(api, "Enter");
  assert.equal(api.messages.length, 1);
  key(api, "Tab");
  assert.equal(api.document.activeElement, session.search);
  key(api, "Escape");
  assert.equal(session.overlay.isConnected, false);
  assert.equal(api.document.activeElement, api.previousFocus);
});

test("closing during load never resurrects picker; repeated opens are ignored", async () => {
  let resolve;
  const api = setup(() => new Promise((done) => { resolve = done; }));
  const pending = api.startTabPicker();
  await api.startTabPicker();
  assert.equal(api.messages.length, 1);
  key(api, "Escape");
  resolve({ tabs: [] });
  await pending;
  assert.equal(api.STATE.tabPickerSession, null);
});

test("a failed tab listing closes picker and restores focus", async () => {
  const api = setup(async () => null);
  await api.startTabPicker();
  assert.equal(api.STATE.tabPickerSession, null);
  assert.equal(api.document.activeElement, api.previousFocus);
  assert.equal(api.toasts[0], "Failed to list tabs");
});

test("failed jump keeps picker open and duplicate Enter is ignored", async () => {
  let resolve;
  const api = setup((message) => message.type === "navbro.tab.list"
    ? Promise.resolve({ tabs: [{ id: 1, title: "One" }] })
    : new Promise((done) => { resolve = done; }));
  await api.startTabPicker();
  key(api, "Enter");
  key(api, "Enter");
  assert.equal(api.messages.length, 2);
  resolve({ ok: false });
  await Promise.resolve();
  assert.ok(api.STATE.tabPickerSession);
  assert.equal(api.toasts.length, 1);
});
