const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(require("node:path").join(__dirname, "../content.js"), "utf8");

function setup() {
  const document = { activeElement: null };
  function element() {
    return {
      style: {}, children: [], value: "", hidden: false, isConnected: true,
      setAttribute() {},
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.append(child); },
      addEventListener(name, callback) { this[name] = callback; },
      focus() { document.activeElement = this; },
      scrollBy(options) { this.lastScroll = options; },
      remove() { this.isConnected = false; },
    };
  }
  document.createElement = element;
  document.body = element();
  const previousFocus = element();
  previousFocus.focus();
  const context = vm.createContext({ document });
  const helpers = source.slice(source.indexOf("  const HOTKEYS_HELP_GROUPS"), source.indexOf("  const showToast ="));
  const handler = source.slice(source.indexOf("  const onKeyDown ="), source.indexOf("    if (matchesCombo(event, KEY_CONFIG.modeToggle))", source.indexOf("  const onKeyDown =")));
  vm.runInContext(`const STATE = { helpSession: null }; const KEY_CONFIG = { scroll: { step: 120 } }; ${helpers}\n${handler}}; globalThis.api = { STATE, showHotkeysHelp, onKeyDown };`, context);
  return { ...context.api, document, previousFocus };
}

function key(api, value) {
  const event = { key: value, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
  api.onKeyDown(event);
  return event;
}

test("help is a persistent centered dialog closed by Escape, restoring focus", () => {
  const api = setup();
  api.showHotkeysHelp();
  const { overlay, dialog } = api.STATE.helpSession;
  assert.match(overlay.style.cssText, /align-items:center;justify-content:center/);
  assert.equal(api.document.activeElement, dialog);
  api.showHotkeysHelp();
  assert.equal(api.document.body.children.length, 1);
  assert.equal(key(api, "j").prevented, true);
  assert.equal(dialog.lastScroll.top, 120);
  assert.equal(key(api, "k").prevented, true);
  assert.equal(dialog.lastScroll.top, -120);
  assert.equal(overlay.isConnected, true);
  assert.equal(key(api, "Escape").prevented, true);
  assert.equal(api.STATE.helpSession, null);
  assert.equal(overlay.isConnected, false);
  assert.equal(api.document.activeElement, api.previousFocus);
});

test("slash searches help only and typing bypasses navigation", () => {
  const api = setup();
  api.showHotkeysHelp();
  const { search, dialog } = api.STATE.helpSession;
  const results = dialog.children[3];
  assert.equal(key(api, "/").prevented, true);
  assert.equal(search.hidden, false);
  assert.equal(api.document.activeElement, search);
  const typing = key(api, "j");
  assert.equal(typing.prevented, false);
  assert.equal(typing.stopped, true);
  assert.equal(dialog.lastScroll, undefined);
  search.value = "YoUTuBe";
  search.input();
  assert.match(results.innerHTML, /YouTube/);
  assert.doesNotMatch(results.innerHTML, /close tab/);
  search.value = "no such hotkey";
  search.input();
  assert.match(results.innerHTML, /No matching hotkeys/);
  search.value = "";
  search.input();
  assert.match(results.innerHTML, /close tab/);
  assert.equal(key(api, "Tab").prevented, true);
  assert.equal(api.document.activeElement, search);
  key(api, "Escape");
  assert.equal(api.STATE.helpSession, null);
});
