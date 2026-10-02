const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(require("node:path").join(__dirname, "../content.js"), "utf8");

test("gt opens the picker and g' requests previous dialog jump, resetting the sequence", async () => {
  const start = source.indexOf('    if (STATE.pendingSequence === "g")', source.indexOf("  const handleNavInput ="));
  const end = source.indexOf('    if (STATE.pendingSequence === "?")', start);
  const context = vm.createContext({});
  vm.runInContext(`
    const STATE = { pendingSequence: "g" };
    let opens = 0;
    const messages = [];
    const isModifierKey = key => key === "Shift";
    const pushDebug = () => {};
    const resetPendingSequence = () => { STATE.pendingSequence = null; };
    const startTabPicker = async () => { opens++; };
    const sendRuntimeMessageWithResponse = async message => { messages.push(message); return { ok: true }; };
    const showToast = () => {};
    const handle = key => { ${source.slice(start, end)} };
    globalThis.api = { STATE, handle, messages, get opens() { return opens; } };
  `, context);
  const api = context.api;
  assert.equal(api.handle("t"), true);
  assert.equal(api.opens, 1);
  assert.equal(api.STATE.pendingSequence, null);
  api.STATE.pendingSequence = "g";
  assert.equal(api.handle("'"), true);
  assert.equal(api.messages[0].type, "navbro.tab.jump_previous");
  assert.equal(api.STATE.pendingSequence, null);
  await Promise.resolve();
});
