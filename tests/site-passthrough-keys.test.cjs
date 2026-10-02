const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
const parsing = source.slice(source.indexOf("  const parsePassthroughKey ="), source.indexOf("  const isModifierKey ="));
const handlers = source.slice(source.indexOf("  const onKeyDown ="), source.indexOf('  window.addEventListener("keydown"'));

function setup(values = [], hasHead = true) {
  const calls = { reset: 0, consume: 0, toggle: 0, nav: 0 };
  const context = {
    document: { head: hasHead ? {
      querySelectorAll(selector) {
        assert.equal(selector, 'meta[name="navbro-passthrough-keys"]');
        return values.map((value) => ({ getAttribute: () => value }));
      },
    } : null },
    STATE: { mode: "nav", passOnceArmed: false, pendingSequence: null },
    KEY_CONFIG: { modeToggle: { key: "Insert", ctrl: true }, passOnceToggle: { key: "v", ctrl: true } },
    resetPendingSequence() { calls.reset++; context.STATE.pendingSequence = null; },
    consumePassOnce() { calls.consume++; context.STATE.passOnceArmed = false; },
    toggleMode() { calls.toggle++; },
    closeQrOverlay: () => false,
    handleTabWindowPickerInput: () => false,
    handleInputJumpInputOrNav: () => false,
    handleHintInput: () => false,
    handleNavInput() { calls.nav++; return true; },
  };
  vm.runInNewContext(`${parsing}\n${handlers}\nthis.matches = isSitePassthroughKey; this.down = onKeyDown; this.up = onKeyUp;`, context);
  return { context, calls };
}

function event(key, modifiers = {}) {
  return {
    key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    ...modifiers,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
}

test("combines tags and parses whitespace-separated keys and exact modifiers", () => {
  const { context } = setup(["  j k / Ctrl+k\n", "aLt+Meta+Enter Space"]);
  for (const e of [event("j"), event("k"), event("/"), event("k", { ctrlKey: true }), event("Enter", { altKey: true, metaKey: true }), event(" ")]) {
    assert.equal(context.matches(e), true);
  }
  for (const e of [event("J", { shiftKey: true }), event("j", { altKey: true }), event("k", { ctrlKey: true, shiftKey: true }), event("Enter"), event("x")]) {
    assert.equal(context.matches(e), false);
  }
});

test("uppercase, explicit Shift, symbols and named keys", () => {
  const { context } = setup(["J Shift+k ? Ctrl++ escape F12"]);
  for (const e of [event("J", { shiftKey: true }), event("K", { shiftKey: true }), event("?", { shiftKey: true }), event("?"), event("+", { ctrlKey: true, shiftKey: true }), event("Escape"), event("F12")]) {
    assert.equal(context.matches(e), true);
  }
  assert.equal(context.matches(event("j")), false);
  assert.equal(context.matches(event("k")), false);
  assert.equal(context.matches(event("Escape", { shiftKey: true })), false);
});

test("missing metadata, invalid entries and sequences do not reserve keys", () => {
  for (const [values, hasHead] of [[[], true], [[null, "", "gg Ctrl+ Ctrl+Ctrl+j Nope"], true], [[], false]]) {
    const { context } = setup(values, hasHead);
    for (const key of ["j", "g", "Enter", " "]) assert.equal(context.matches(event(key)), false);
  }
});

test("reserved keydown resets sequences and consumes one-shot without blocking the page", () => {
  const { context, calls } = setup(["j"]);
  context.STATE.pendingSequence = "g";
  context.STATE.passOnceArmed = true;
  const e = event("j");
  context.down(e);
  assert.equal(e.prevented, undefined);
  assert.equal(e.stopped, undefined);
  assert.equal(context.STATE.pendingSequence, null);
  assert.equal(context.STATE.passOnceArmed, false);
  assert.deepEqual(calls, { reset: 1, consume: 1, toggle: 0, nav: 0 });
});

test("reserved keys bypass mode toggles, modes, overlays, keyup and repeats", () => {
  const { context, calls } = setup(["Ctrl+Insert j"]);
  for (const mode of ["nav", "pass", "input", "hint"]) {
    context.STATE.mode = mode;
    context.STATE.helpSession = {};
    context.STATE.tabPickerSession = {};
    for (const e of [event("Insert", { ctrlKey: true }), event("j", { repeat: true })]) {
      context.down(e);
      context.up(e);
      assert.equal(e.prevented, undefined);
      assert.equal(e.stopped, undefined);
    }
  }
  assert.equal(calls.toggle, 0);
});

test("unreserved keys still run normal navbro handling", () => {
  const { context, calls } = setup(["j"]);
  const toggle = event("Insert", { ctrlKey: true });
  context.down(toggle);
  assert.equal(calls.toggle, 1);
  assert.equal(toggle.prevented, true);
  const nav = event("k");
  context.down(nav);
  assert.equal(calls.nav, 1);
  assert.equal(nav.prevented, true);
  assert.equal(nav.stopped, true);
});
