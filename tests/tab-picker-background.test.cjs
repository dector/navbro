const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../background.js"), "utf8");

// Values returned from the vm realm have a different Object prototype, so
// round-trip them before strict structural comparison.
const plain = (value) => JSON.parse(JSON.stringify(value));

function makeTab(id, windowId, index, extra = {}) {
  return {
    id,
    windowId,
    index,
    active: false,
    title: `Tab ${id}`,
    url: `https://example.com/${id}`,
    ...extra,
  };
}

function sender(tabId, windowId) {
  return { tab: { id: tabId, windowId } };
}

function setup(initialTabs, options = {}) {
  const tabs = initialTabs.map((tab) => ({ ...tab }));
  const listeners = [];
  const removedListeners = [];
  const updateCalls = [];
  const queryCalls = [];
  const localCalls = { get: 0, set: 0 };
  const failUpdateIds = new Set();
  const sessionBacking = options.storageBacking || {};
  const updateDelayMs = Number(options.updateDelayMs) || 0;
  let beforeUpdate = null;

  const browser = {
    runtime: {
      onMessage: { addListener: (listener) => listeners.push(listener) },
      getURL: (value) => `moz-extension://test/${value}`,
    },
    tabs: {
      query: async (queryInfo = {}) => {
        queryCalls.push(queryInfo);
        return tabs.filter((tab) => {
          if (queryInfo.windowId != null && tab.windowId !== queryInfo.windowId) return false;
          if (queryInfo.active && !tab.active) return false;
          return true;
        });
      },
      update: async (tabId, props) => {
        updateCalls.push({ tabId, props });
        if (updateDelayMs) await new Promise((resolve) => setTimeout(resolve, updateDelayMs));
        if (beforeUpdate) beforeUpdate(tabId, props);
        if (failUpdateIds.has(tabId)) throw new Error(`No tab with id: ${tabId}`);
        const target = tabs.find((tab) => tab.id === tabId);
        if (!target) throw new Error(`No tab with id: ${tabId}`);
        if (props.active) {
          tabs.forEach((tab) => {
            if (tab.windowId === target.windowId) {
              tab.active = tab.id === tabId;
            }
          });
        }
        return { ...target };
      },
      create: async () => ({}),
      move: async () => {},
      remove: async () => {},
    },
    sessions: { restore: async () => {} },
    storage: {
      local: {
        get: async () => {
          localCalls.get += 1;
          return {};
        },
        set: async () => {
          localCalls.set += 1;
        },
      },
    },
  };

  if (options.withStorage !== false) {
    browser.storage.session = {
      get: async (key) => {
        const value = sessionBacking[key];
        return { [key]: value === undefined ? undefined : structuredClone(value) };
      },
      set: async (values) => {
        for (const [key, value] of Object.entries(values)) {
          sessionBacking[key] = structuredClone(value);
        }
      },
    };
  }

  if (options.withWindows !== false) {
    browser.windows = {
      onRemoved: { addListener: (listener) => removedListeners.push(listener) },
      getAll: async () => [],
      update: async () => {},
      create: async () => {},
    };
  }

  const context = vm.createContext({ browser });
  vm.runInContext(source, context);

  return {
    tabs,
    listener: listeners[0],
    removedListeners,
    updateCalls,
    queryCalls,
    localCalls,
    failUpdateIds,
    sessionBacking,
    setBeforeUpdate: (fn) => {
      beforeUpdate = fn;
    },
  };
}

test("navbro.tab.list returns sender window tabs sorted with picker fields", async () => {
  const api = setup([
    makeTab(3, 1, 2, { title: "Third", url: "https://c", active: true }),
    makeTab(1, 1, 0, { title: "First", url: "https://a" }),
    makeTab(2, 2, 0, { title: "Other window" }),
  ]);

  const result = await api.listener({ type: "navbro.tab.list" }, sender(1, 1));

  assert.deepEqual(plain(result), {
    tabs: [
      { id: 1, title: "First", url: "https://a", active: false, index: 0 },
      { id: 3, title: "Third", url: "https://c", active: true, index: 2 },
    ],
  });
  assert.deepEqual(plain(api.queryCalls), [{ windowId: 1 }]);
});

test("navbro.tab.list without a sender window returns an empty list", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true })]);

  assert.deepEqual(plain(await api.listener({ type: "navbro.tab.list" }, { tab: {} })), { tabs: [] });
});

test("navbro.tab.jump activates the target and jump_previous returns to origin", async () => {
  const api = setup([
    makeTab(1, 1, 0, { active: true }),
    makeTab(2, 1, 1),
    makeTab(3, 1, 2),
  ]);

  const jump = await api.listener({ type: "navbro.tab.jump", tabId: 3 }, sender(1, 1));
  assert.deepEqual(plain(jump), { ok: true });
  assert.deepEqual(plain(api.updateCalls), [{ tabId: 3, props: { active: true } }]);
  assert.equal(api.tabs.find((tab) => tab.id === 3).active, true);

  const back = await api.listener({ type: "navbro.tab.jump_previous" }, sender(3, 1));
  assert.deepEqual(plain(back), { ok: true });
  assert.equal(api.tabs.find((tab) => tab.id === 1).active, true);
});

test("navbro.tab.jump to the current tab is a no-op that records no history", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true }), makeTab(2, 1, 1)]);

  const result = await api.listener({ type: "navbro.tab.jump", tabId: 1 }, sender(1, 1));
  assert.deepEqual(plain(result), { ok: true });
  assert.equal(api.updateCalls.length, 0);

  const back = await api.listener({ type: "navbro.tab.jump_previous" }, sender(1, 1));
  assert.deepEqual(plain(back), { ok: false, error: "no_previous_tab" });
});

test("navbro.tab.jump rejects tabs outside the sender window and invalid ids", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true }), makeTab(2, 2, 0)]);

  assert.deepEqual(
    plain(await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(1, 1))),
    { ok: false, error: "tab_not_found" },
  );
  assert.deepEqual(
    plain(await api.listener({ type: "navbro.tab.jump", tabId: "nope" }, sender(1, 1))),
    { ok: false, error: "invalid_tab_id" },
  );
  assert.equal(api.updateCalls.length, 0);
});

test("navbro.tab.jump that fails to activate records no history", async () => {
  const api = setup([
    makeTab(1, 1, 0, { active: true }),
    makeTab(2, 1, 1),
  ]);
  api.failUpdateIds.add(2);

  assert.deepEqual(
    plain(await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(1, 1))),
    { ok: false, error: "activate_failed" },
  );
  assert.deepEqual(
    plain(await api.listener({ type: "navbro.tab.jump_previous" }, sender(1, 1))),
    { ok: false, error: "no_previous_tab" },
  );
});

test("navbro.tab.jump_previous skips closed, moved, and current tabs", async () => {
  const api = setup([
    makeTab(1, 1, 0, { active: true }),
    makeTab(2, 1, 1),
    makeTab(3, 1, 2),
    makeTab(4, 1, 3),
  ]);

  // Build history [1, 4, 3] and finish on tab 2.
  await api.listener({ type: "navbro.tab.jump", tabId: 4 }, sender(1, 1));
  await api.listener({ type: "navbro.tab.jump", tabId: 3 }, sender(4, 1));
  await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(3, 1));
  assert.equal(api.tabs.find((tab) => tab.id === 2).active, true);

  // Close tab 3 and move tab 1 to another window; tab 4 stays usable.
  api.tabs.splice(api.tabs.findIndex((tab) => tab.id === 3), 1);
  api.tabs.find((tab) => tab.id === 1).windowId = 99;

  const back = await api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1));
  assert.deepEqual(plain(back), { ok: true });
  assert.equal(api.tabs.find((tab) => tab.id === 4).active, true);

  const exhausted = await api.listener({ type: "navbro.tab.jump_previous" }, sender(4, 1));
  assert.deepEqual(plain(exhausted), { ok: false, error: "no_previous_tab" });
});

test("navbro.tab.jump_previous retains the target when activation fails", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true }), makeTab(2, 1, 1)]);
  await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(1, 1));

  api.failUpdateIds.add(1);
  const failed = await api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1));
  assert.deepEqual(plain(failed), { ok: false, error: "activate_failed" });

  // The origin is retained, so a later attempt succeeds.
  api.failUpdateIds.delete(1);
  const retry = await api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1));
  assert.deepEqual(plain(retry), { ok: true });
  assert.equal(api.tabs.find((tab) => tab.id === 1).active, true);
});

test("navbro.tab.jump_previous skips a tab that closes after the query", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true }), makeTab(2, 1, 1)]);
  await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(1, 1));

  api.failUpdateIds.add(1);
  api.setBeforeUpdate((tabId) => {
    if (tabId !== 1) return;
    const index = api.tabs.findIndex((tab) => tab.id === 1);
    if (index >= 0) api.tabs.splice(index, 1);
  });

  const result = await api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1));
  assert.deepEqual(plain(result), { ok: false, error: "no_previous_tab" });
});

test("tab picker history is per-window, capped at ten, and never uses local storage", async () => {
  const api = setup([
    makeTab(1, 1, 0, { active: true }),
    makeTab(2, 1, 1),
    makeTab(11, 2, 0, { active: true }),
    makeTab(12, 2, 1),
  ]);

  // Bounce between tabs 1 and 2 twelve times: twelve origins, only ten kept.
  for (let i = 0; i < 12; i += 1) {
    const from = i % 2 === 0 ? 1 : 2;
    const to = i % 2 === 0 ? 2 : 1;
    const result = await api.listener({ type: "navbro.tab.jump", tabId: to }, sender(from, 1));
    assert.deepEqual(plain(result), { ok: true });
  }

  // The other window kept its own (empty) history.
  assert.deepEqual(
    plain(await api.listener({ type: "navbro.tab.jump_previous" }, sender(11, 2))),
    { ok: false, error: "no_previous_tab" },
  );

  let successes = 0;
  for (let i = 0; i < 15; i += 1) {
    const active = api.tabs.find((tab) => tab.windowId === 1 && tab.active);
    const result = await api.listener({ type: "navbro.tab.jump_previous" }, sender(active.id, 1));
    if (!result.ok) {
      assert.deepEqual(plain(result), { ok: false, error: "no_previous_tab" });
      break;
    }
    successes += 1;
  }
  assert.equal(successes, 10);
  assert.equal(api.localCalls.set, 0);
  assert.equal(api.localCalls.get, 0);
});

test("closing a window clears its tab picker history", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true }), makeTab(2, 1, 1)]);

  await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(1, 1));
  assert.equal(api.removedListeners.length, 1);

  api.removedListeners[0](1);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(
    plain(await api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1))),
    { ok: false, error: "no_previous_tab" },
  );
});

test("jump history survives a background reload via storage.session", async () => {
  const storageBacking = {};
  const first = setup([makeTab(1, 1, 0, { active: true }), makeTab(2, 1, 1)], {
    storageBacking,
  });
  assert.deepEqual(
    plain(await first.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(1, 1))),
    { ok: true },
  );
  assert.equal(JSON.stringify(storageBacking).includes("navbro.tabPickerHistory"), true);

  // Simulate the MV3 event background unloading and starting fresh.
  const second = setup([makeTab(1, 1, 0), makeTab(2, 1, 1, { active: true })], {
    storageBacking,
  });
  const back = await second.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1));
  assert.deepEqual(plain(back), { ok: true });
  assert.equal(second.tabs.find((tab) => tab.id === 1).active, true);
});

test("rapid repeated jump_previous calls are serialized", async () => {
  const api = setup(
    [
      makeTab(1, 1, 0, { active: true }),
      makeTab(2, 1, 1),
      makeTab(3, 1, 2),
    ],
    // A slow activation widens the race window between the two calls.
    { updateDelayMs: 5 },
  );

  // Build history [1, 3] and end on tab 2.
  await api.listener({ type: "navbro.tab.jump", tabId: 3 }, sender(1, 1));
  await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(3, 1));
  const updatesBefore = api.updateCalls.length;

  // Fire two g' presses before either has resolved.
  const [first, second] = await Promise.all([
    api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1)),
    api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1)),
  ]);

  assert.deepEqual(plain(first), { ok: true });
  assert.deepEqual(plain(second), { ok: true });

  // Serialized: the first returns to 3, the second then returns to 1. Without
  // the queue both would read [1, 3] and activate 3 twice.
  const activated = api.updateCalls.slice(updatesBefore).map((call) => call.tabId);
  assert.deepEqual(activated, [3, 1]);
  assert.equal(api.tabs.find((tab) => tab.id === 1).active, true);
});

test("history falls back to memory when storage.session is unavailable", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true }), makeTab(2, 1, 1)], {
    withStorage: false,
  });

  await api.listener({ type: "navbro.tab.jump", tabId: 2 }, sender(1, 1));
  const back = await api.listener({ type: "navbro.tab.jump_previous" }, sender(2, 1));
  assert.deepEqual(plain(back), { ok: true });
  assert.equal(api.tabs.find((tab) => tab.id === 1).active, true);
});

test("background loads and lists tabs when the windows API is unavailable", async () => {
  const api = setup([makeTab(1, 1, 0, { active: true })], { withWindows: false });

  assert.equal(api.removedListeners.length, 0);
  assert.deepEqual(plain(await api.listener({ type: "navbro.tab.list" }, sender(1, 1))), {
    tabs: [{ id: 1, title: "Tab 1", url: "https://example.com/1", active: true, index: 0 }],
  });
});
