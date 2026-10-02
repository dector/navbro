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
      scrollTop: 0, clientHeight: 120, offsetHeight: 40,
      get scrollHeight() { return this.children.reduce((sum, child) => sum + child.offsetHeight, 0); },
      get offsetTop() {
        if (!this.parent) return 0;
        const index = this.parent.children.indexOf(this);
        return this.parent.children.slice(0, index).reduce((sum, child) => sum + child.offsetHeight, 0);
      },
      setAttribute(name, value) { this[name] = value; },
      append(...children) { children.forEach(child => { child.parent = this; }); this.children.push(...children); },
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
  vm.runInContext(`const STATE = { tabPickerSession: null }; const KEY_CONFIG = { keySequence: { timeoutMs: 5000 } }; const isModifierKey = key => ["Shift", "Control", "Alt", "Meta"].includes(key); const sendRuntimeMessageWithResponse = send; const showToast = message => toasts.push(message); ${helpers}; globalThis.api = { STATE, startTabPicker, closeTabPicker, handleTabPickerInput };`, context);
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
  assert.equal(session.list.scrollTop, 0);
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

function manyTabs(activeIndex) {
  return setup(async () => ({ tabs: Array.from({ length: 9 }, (_, index) => ({
    id: index + 1, title: `Tab ${index + 1}`, url: `https://tab${index + 1}.test`, active: index === activeIndex,
  })) }));
}

test("selected tab is centered with centered counts above and below", async () => {
  const api = manyTabs(4);
  await api.startTabPicker();
  const session = api.STATE.tabPickerSession;
  assert.equal(session.list.scrollTop, 120);
  assert.equal(session.above.textContent, "↑ 3");
  assert.equal(session.below.textContent, "↓ 3");
  assert.match(session.above.style.cssText, /text-align:center/);
  assert.match(session.below.style.cssText, /text-align:center/);
  key(api, "j");
  assert.equal(session.list.scrollTop, 160);
  assert.equal(session.above.textContent, "↑ 4");
  assert.equal(session.below.textContent, "↓ 2");
  session.list.scrollTop = 0;
  session.list.scroll();
  assert.equal(session.above.textContent, "↑ 0");
  assert.equal(session.below.textContent, "↓ 6");
});

test("centering clamps at both ends without empty space; gg/G select first/last", async () => {
  const api = manyTabs(8);
  await api.startTabPicker();
  const session = api.STATE.tabPickerSession;
  assert.equal(session.list.scrollTop, 240);
  assert.equal(session.above.textContent, "↑ 6");
  assert.equal(session.below.textContent, "↓ 0");
  key(api, "g");
  assert.equal(session.selectedIndex, 8);
  key(api, "g");
  assert.equal(session.selectedIndex, 0);
  assert.equal(session.list.scrollTop, 0);
  assert.equal(session.above.textContent, "↑ 0");
  assert.equal(session.below.textContent, "↓ 6");
  key(api, "Shift");
  key(api, "G", { shiftKey: true });
  assert.equal(session.selectedIndex, 8);
  assert.equal(session.list.scrollTop, 240);
});

test("gg resets on other keys and timeout, and gg/G remain text in search", async () => {
  const api = manyTabs(4);
  await api.startTabPicker();
  const session = api.STATE.tabPickerSession;
  key(api, "g");
  key(api, "j");
  key(api, "g");
  assert.equal(session.selectedIndex, 5);
  session.pendingGAt = Date.now() - 6000;
  key(api, "g");
  assert.equal(session.selectedIndex, 5);
  key(api, "/");
  assert.equal(key(api, "g").prevented, false);
  assert.equal(key(api, "g").prevented, false);
  assert.equal(key(api, "G").prevented, false);
  assert.equal(session.selectedIndex, 5);
  session.search.value = "Tab 7";
  session.search.input();
  assert.equal(session.list.scrollTop, 0);
  assert.equal(session.above.textContent, "↑ 0");
  assert.equal(session.below.textContent, "↓ 0");
  session.search.value = "none";
  session.search.input();
  assert.equal(session.above.textContent, "↑ 0");
  assert.equal(session.below.textContent, "↓ 0");
});

test("Shift-j/k move five items with wrapping and remain text in search", async () => {
  const api = manyTabs(4);
  await api.startTabPicker();
  const session = api.STATE.tabPickerSession;
  assert.equal(key(api, "J", { shiftKey: true }).prevented, true);
  assert.equal(session.selectedIndex, 0);
  key(api, "K", { shiftKey: true });
  assert.equal(session.selectedIndex, 4);
  key(api, "j", { shiftKey: true });
  assert.equal(session.selectedIndex, 0);
  key(api, "k", { shiftKey: true });
  assert.equal(session.selectedIndex, 4);
  key(api, "/");
  assert.equal(key(api, "J", { shiftKey: true }).prevented, false);
  assert.equal(key(api, "K", { shiftKey: true }).prevented, false);
  assert.equal(session.selectedIndex, 4);
});

test("five-item moves handle short and empty lists", async () => {
  const api = setup();
  await api.startTabPicker();
  const session = api.STATE.tabPickerSession;
  key(api, "K", { shiftKey: true });
  assert.equal(session.selectedIndex, 1);
  key(api, "J", { shiftKey: true });
  assert.equal(session.selectedIndex, 0);
  key(api, "/");
  session.search.value = "missing";
  session.search.input();
  session.dialog.focus();
  key(api, "K", { shiftKey: true });
  assert.equal(session.selectedIndex, 0);
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
