const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");

function runStartup(values, hasHead = true) {
  const continued = new Error("normal startup reached");
  const context = {
    document: {
      head: hasHead ? {
        querySelectorAll(selector) {
          assert.equal(selector, 'meta[name="navbro-disable"]');
          return values.map((value) => ({
            getAttribute(attribute) {
              assert.equal(attribute, "content");
              return value;
            },
          }));
        },
      } : null,
    },
    window: {
      get NAVBRO_KEY_CONFIG() { throw continued; },
    },
  };
  return { run: () => vm.runInNewContext(source, context), continued };
}

test("website opt-out exits before accessing runtime, UI, or listeners", () => {
  for (const values of [["true"], [" TRUE "], ["false", "true"]]) {
    const { run } = runStartup(values);
    assert.doesNotThrow(run);
  }
});

test("absent or non-true opt-out preserves normal startup", () => {
  for (const values of [[], [null], [""], ["false"], ["1"], ["trueish"]]) {
    const { run, continued } = runStartup(values);
    assert.throws(run, (error) => error === continued);
  }
});

test("a missing head preserves normal startup", () => {
  const { run, continued } = runStartup([], false);
  assert.throws(run, (error) => error === continued);
});
