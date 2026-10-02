const runtime = typeof browser !== "undefined" ? browser : chrome;

const getOrderedTabs = async () => {
  const tabs = await runtime.tabs.query({ currentWindow: true });
  return tabs.slice().sort((a, b) => a.index - b.index);
};

const activateAdjacentTab = async (direction) => {
  const tabs = await getOrderedTabs();
  if (!tabs.length) return;

  const activeIndex = tabs.findIndex((tab) => tab.active);
  if (activeIndex === -1) return;

  const targetIndex = (activeIndex + direction + tabs.length) % tabs.length;
  const targetTab = tabs[targetIndex];
  if (!targetTab?.id) return;

  await runtime.tabs.update(targetTab.id, { active: true });
};

const moveActiveTab = async (direction) => {
  const tabs = await getOrderedTabs();
  if (!tabs.length) return;

  const activeIndex = tabs.findIndex((tab) => tab.active);
  if (activeIndex === -1) return;

  const activeTab = tabs[activeIndex];
  if (!activeTab?.id) return;

  const targetIndex = Math.min(Math.max(activeIndex + direction, 0), tabs.length - 1);
  if (targetIndex === activeIndex) return;

  await runtime.tabs.move(activeTab.id, { index: targetIndex });
  await runtime.tabs.update(activeTab.id, { active: true });
};

const activateNextAudibleTab = async () => {
  const tabs = await getOrderedTabs();
  if (!tabs.length) return;

  const audibleTabs = tabs.filter((tab) => tab.audible && tab.id);
  if (!audibleTabs.length) return;

  const activeIndex = tabs.findIndex((tab) => tab.active);
  if (activeIndex === -1) return;

  const activeTab = tabs[activeIndex];
  const activeAudibleIndex = audibleTabs.findIndex((tab) => tab.id === activeTab?.id);
  const targetAudibleIndex =
    activeAudibleIndex >= 0
      ? (activeAudibleIndex + 1) % audibleTabs.length
      : audibleTabs.findIndex((tab) => tab.index > activeIndex);

  const fallbackIndex = targetAudibleIndex === -1 ? 0 : targetAudibleIndex;
  const targetTab = audibleTabs[fallbackIndex];
  if (!targetTab?.id) return;

  await runtime.tabs.update(targetTab.id, { active: true });
};

const activateRandomTab = async () => {
  const tabs = await getOrderedTabs();
  if (!tabs.length) return;

  const withIds = tabs.filter((tab) => tab.id);
  if (!withIds.length) return;

  const activeTab = withIds.find((tab) => tab.active);
  const candidates = withIds.length > 1 && activeTab?.id
    ? withIds.filter((tab) => tab.id !== activeTab.id)
    : withIds;

  if (!candidates.length) return;

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const targetTab = candidates[randomIndex];
  if (!targetTab?.id) return;

  await runtime.tabs.update(targetTab.id, { active: true });
};

const activateFirstTab = async () => {
  const tabs = await getOrderedTabs();
  const firstTab = tabs[0];
  if (!firstTab?.id) return;

  await runtime.tabs.update(firstTab.id, { active: true });
};

const activateLastTab = async () => {
  const tabs = await getOrderedTabs();
  const lastTab = tabs[tabs.length - 1];
  if (!lastTab?.id) return;

  await runtime.tabs.update(lastTab.id, { active: true });
};

const listWindowsForTabMove = async () => {
  const activeTabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = activeTabs[0];
  const currentWindowId = activeTab?.windowId;

  const windows = await runtime.windows.getAll({ populate: true, windowTypes: ["normal"] });
  const items = windows
    .map((windowItem) => {
      const tabs = (windowItem.tabs || []).slice().sort((a, b) => a.index - b.index);
      if (!tabs.length || !windowItem.id) return null;

      const activeWindowTab = tabs.find((tab) => tab.active) || tabs[0];
      const title = (activeWindowTab?.title || "(untitled)").replace(/\s+/g, " ").trim();

      return {
        windowId: windowItem.id,
        activeTabTitle: title.length > 90 ? `${title.slice(0, 87)}...` : title,
        tabCount: tabs.length,
        activeTabIndex: activeWindowTab?.index ?? 0,
        isCurrentWindow: windowItem.id === currentWindowId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.isCurrentWindow && !b.isCurrentWindow) return -1;
      if (!a.isCurrentWindow && b.isCurrentWindow) return 1;
      return a.windowId - b.windowId;
    });

  return { windows: items };
};

const moveActiveTabToWindow = async (payload = {}) => {
  const targetWindowId = Number(payload.targetWindowId);
  const placement = payload.placement === "end" ? "end" : "after_active";
  if (!Number.isInteger(targetWindowId)) return { ok: false, error: "invalid_target_window" };

  const activeTabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = activeTabs[0];
  if (!activeTab?.id) return { ok: false, error: "no_active_tab" };

  const windows = await runtime.windows.getAll({ populate: true, windowTypes: ["normal"] });
  const targetWindow = windows.find((windowItem) => windowItem.id === targetWindowId);
  if (!targetWindow) return { ok: false, error: "target_window_not_found" };

  const targetTabs = (targetWindow.tabs || []).slice().sort((a, b) => a.index - b.index);
  const activeTargetTab = targetTabs.find((tab) => tab.active);
  let targetIndex = targetTabs.length;

  if (placement === "after_active" && activeTargetTab) {
    targetIndex = activeTargetTab.index + 1;
  }

  if (activeTab.windowId === targetWindowId && activeTab.index < targetIndex) {
    targetIndex -= 1;
  }

  targetIndex = Math.max(0, targetIndex);

  await runtime.tabs.move(activeTab.id, { windowId: targetWindowId, index: targetIndex });
  await runtime.tabs.update(activeTab.id, { active: true });
  await runtime.windows.update(targetWindowId, { focused: true });

  return { ok: true };
};

const closeActiveTab = async () => {
  const tabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = tabs[0];
  if (!activeTab?.id) return;

  await runtime.tabs.remove(activeTab.id);
};

const openTabAfterCurrent = async () => {
  const tabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = tabs[0];
  const newTabUrl = typeof runtime.runtime?.getURL === "function" ? runtime.runtime.getURL("newtab.html") : undefined;

  const createdTab = await runtime.tabs.create({
    active: true,
    ...(newTabUrl ? { url: newTabUrl } : {}),
  });

  if (!activeTab?.id || !createdTab?.id) {
    return;
  }

  const targetIndex = Math.max(0, activeTab.index + 1);
  await runtime.tabs.move(createdTab.id, {
    windowId: activeTab.windowId,
    index: targetIndex,
  });
  await runtime.tabs.update(createdTab.id, { active: true });
};

const detachActiveTab = async () => {
  if (typeof runtime.windows?.create !== "function") return;

  const tabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = tabs[0];
  if (!activeTab?.id) return;

  await runtime.windows.create({ tabId: activeTab.id });
};

const restoreClosedTab = async () => {
  if (runtime.sessions?.restore) {
    await runtime.sessions.restore();
  }
};

const stopActiveTabLoading = async () => {
  const tabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = tabs[0];
  if (!activeTab?.id) return;

  if (activeTab.status !== "loading") return;

  if (typeof runtime.tabs.stopLoading === "function") {
    await runtime.tabs.stopLoading(activeTab.id);
    return;
  }

  if (typeof runtime.tabs.stop === "function") {
    await runtime.tabs.stop(activeTab.id);
  }
};

const getActiveTabId = async () => {
  const tabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = tabs[0];
  return activeTab?.id ?? null;
};

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const applyActiveTabZoom = async (payload = {}) => {
  if (typeof runtime.tabs.getZoom !== "function" || typeof runtime.tabs.setZoom !== "function") {
    return;
  }

  const tabId = await getActiveTabId();
  if (!tabId) return;

  const min = Number(payload.min) || 0.3;
  const max = Number(payload.max) || 3;
  const step = Number(payload.step) || 0.1;
  const strongStep = Number(payload.strongStep) || 0.2;
  const presetMin = Number(payload.presets?.min) || 0.5;
  const presetMax = Number(payload.presets?.max) || 2;
  const presetReset = Number(payload.presets?.reset) || 1;

  const currentZoom = await runtime.tabs.getZoom(tabId);
  let nextZoom = currentZoom;

  if (payload.action === "in") nextZoom = currentZoom + step;
  if (payload.action === "out") nextZoom = currentZoom - step;
  if (payload.action === "in_strong") nextZoom = currentZoom + strongStep;
  if (payload.action === "out_strong") nextZoom = currentZoom - strongStep;
  if (payload.action === "preset_max") nextZoom = presetMax;
  if (payload.action === "preset_min") nextZoom = presetMin;
  if (payload.action === "reset") nextZoom = presetReset;

  nextZoom = clamp(nextZoom, min, max);
  await runtime.tabs.setZoom(tabId, nextZoom);
};

const TAB_PICKER_HISTORY_LIMIT = 10;
const TAB_PICKER_HISTORY_STORAGE_KEY = "navbro.tabPickerHistory";
const tabPickerHistoryByWindow = new Map();
let tabPickerHistoryLoaded = false;
let tabPickerHistoryLoadPromise = null;
let tabPickerHistoryQueue = Promise.resolve();

// Serialize history reads/writes so rapid repeated jumps cannot read the same
// snapshot and activate the same target twice (or clobber each other).
const runTabPickerHistoryTask = (task) => {
  const result = tabPickerHistoryQueue.then(task, task);
  tabPickerHistoryQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

const getTabPickerWindowId = (sender) => {
  const windowId = sender?.tab?.windowId;
  return typeof windowId === "number" ? windowId : null;
};

const getTabPickerSessionStorage = () => {
  const area = runtime.storage?.session;
  if (!area || typeof area.get !== "function" || typeof area.set !== "function") return null;
  return area;
};

const loadTabPickerHistory = () => {
  if (tabPickerHistoryLoaded) return Promise.resolve();
  if (!tabPickerHistoryLoadPromise) {
    tabPickerHistoryLoadPromise = (async () => {
      const area = getTabPickerSessionStorage();
      if (area) {
        try {
          const stored = await area.get(TAB_PICKER_HISTORY_STORAGE_KEY);
          const data = stored?.[TAB_PICKER_HISTORY_STORAGE_KEY];
          if (data && typeof data === "object") {
            for (const [rawWindowId, rawHistory] of Object.entries(data)) {
              const windowId = Number(rawWindowId);
              if (!Number.isInteger(windowId) || !Array.isArray(rawHistory)) continue;
              const history = rawHistory
                .filter((tabId) => Number.isInteger(tabId))
                .slice(-TAB_PICKER_HISTORY_LIMIT);
              if (history.length) tabPickerHistoryByWindow.set(windowId, history);
            }
          }
        } catch {
          // Ignore unavailable/corrupt session storage and keep memory-only history.
        }
      }
      tabPickerHistoryLoaded = true;
    })();
  }
  return tabPickerHistoryLoadPromise;
};

const persistTabPickerHistory = async () => {
  await loadTabPickerHistory();
  const area = getTabPickerSessionStorage();
  if (!area) return;

  const data = {};
  for (const [windowId, history] of tabPickerHistoryByWindow.entries()) {
    data[String(windowId)] = history;
  }

  try {
    await area.set({ [TAB_PICKER_HISTORY_STORAGE_KEY]: data });
  } catch {
    // Keep serving from memory if session storage writes fail.
  }
};

const readTabPickerWindowTabs = async (windowId) => {
  const tabs = await runtime.tabs.query({ windowId });
  return tabs.slice().sort((a, b) => a.index - b.index);
};

const listTabPickerTabs = async (sender) => {
  const windowId = getTabPickerWindowId(sender);
  if (windowId == null) return { tabs: [] };

  const tabs = await readTabPickerWindowTabs(windowId);
  return {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      title: tab.title || "",
      url: tab.url || "",
      active: !!tab.active,
      index: tab.index,
    })),
  };
};

const writeTabPickerHistory = (windowId, history) => {
  if (history.length) {
    tabPickerHistoryByWindow.set(windowId, history);
  } else {
    tabPickerHistoryByWindow.delete(windowId);
  }
};

const recordTabPickerJump = async (windowId, tabId) => {
  if (windowId == null || tabId == null) return;

  const history = (tabPickerHistoryByWindow.get(windowId) || []).slice();
  history.push(tabId);
  while (history.length > TAB_PICKER_HISTORY_LIMIT) {
    history.shift();
  }
  tabPickerHistoryByWindow.set(windowId, history);
  await persistTabPickerHistory();
};

const activateTabFromPicker = async (tabId, windowId) => {
  try {
    await runtime.tabs.update(tabId, { active: true });
    return { ok: true };
  } catch {
    // The tab may have closed between listing and activation. Check whether it
    // still exists so callers can decide to retain or skip it.
    try {
      const tabs = await readTabPickerWindowTabs(windowId);
      return { ok: false, stillExists: tabs.some((tab) => tab.id === tabId) };
    } catch {
      return { ok: false, stillExists: true };
    }
  }
};

const jumpToTabFromPicker = async (payload = {}, sender) => {
  const windowId = getTabPickerWindowId(sender);
  if (windowId == null) return { ok: false, error: "no_sender_window" };

  const targetTabId = Number(payload.tabId);
  if (!Number.isInteger(targetTabId)) return { ok: false, error: "invalid_tab_id" };

  const originTabId = sender?.tab?.id;
  if (originTabId != null && targetTabId === originTabId) {
    return { ok: true };
  }

  await loadTabPickerHistory();
  const tabs = await readTabPickerWindowTabs(windowId);
  const targetTab = tabs.find((tab) => tab.id === targetTabId);
  if (!targetTab) return { ok: false, error: "tab_not_found" };

  const activation = await activateTabFromPicker(targetTabId, windowId);
  if (!activation.ok) return { ok: false, error: "activate_failed" };

  if (originTabId != null) {
    await recordTabPickerJump(windowId, originTabId);
  }

  return { ok: true };
};

const jumpToPreviousTabFromPicker = async (sender) => {
  const windowId = getTabPickerWindowId(sender);
  if (windowId == null) return { ok: false, error: "no_sender_window" };

  await loadTabPickerHistory();
  const history = (tabPickerHistoryByWindow.get(windowId) || []).slice();
  const tabs = await readTabPickerWindowTabs(windowId);
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const currentTabId = tabs.find((tab) => tab.active)?.id ?? sender?.tab?.id ?? null;

  while (history.length) {
    const candidate = history[history.length - 1];

    if (candidate == null || candidate === currentTabId || !tabIds.has(candidate)) {
      history.pop();
      continue;
    }

    const activation = await activateTabFromPicker(candidate, windowId);
    if (activation.ok) {
      history.pop();
      writeTabPickerHistory(windowId, history);
      await persistTabPickerHistory();
      return { ok: true };
    }

    if (activation.stillExists) {
      // Retain the target at the top of history so a later attempt can retry it.
      writeTabPickerHistory(windowId, history);
      await persistTabPickerHistory();
      return { ok: false, error: "activate_failed" };
    }

    // The tab closed after we listed it; skip it and try the next origin.
    history.pop();
  }

  writeTabPickerHistory(windowId, history);
  await persistTabPickerHistory();
  return { ok: false, error: "no_previous_tab" };
};

if (typeof runtime.windows?.onRemoved?.addListener === "function") {
  runtime.windows.onRemoved.addListener((windowId) => {
    void runTabPickerHistoryTask(async () => {
      await loadTabPickerHistory();
      tabPickerHistoryByWindow.delete(windowId);
      await persistTabPickerHistory();
    });
  });
}

runtime.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "navbro.window.list_for_tab_move") {
    return listWindowsForTabMove();
  }

  if (message.type === "navbro.tab.move_to_window") {
    return moveActiveTabToWindow(message);
  }

  if (message.type === "navbro.tab.prev") {
    void activateAdjacentTab(-1);
  }

  if (message.type === "navbro.tab.next") {
    void activateAdjacentTab(1);
  }

  if (message.type === "navbro.tab.move_prev") {
    void moveActiveTab(-1);
  }

  if (message.type === "navbro.tab.move_next") {
    void moveActiveTab(1);
  }

  if (message.type === "navbro.tab.audio_next") {
    void activateNextAudibleTab();
  }

  if (message.type === "navbro.tab.random") {
    void activateRandomTab();
  }

  if (message.type === "navbro.tab.first") {
    void activateFirstTab();
  }

  if (message.type === "navbro.tab.last") {
    void activateLastTab();
  }

  if (message.type === "navbro.tab.list") {
    return listTabPickerTabs(sender);
  }

  if (message.type === "navbro.tab.jump") {
    return runTabPickerHistoryTask(() => jumpToTabFromPicker(message, sender));
  }

  if (message.type === "navbro.tab.jump_previous") {
    return runTabPickerHistoryTask(() => jumpToPreviousTabFromPicker(sender));
  }

  if (message.type === "navbro.link.open_tab") {
    const url = typeof message.url === "string" ? message.url : null;
    if (!url) return;

    const active = !!message.active;
    const sourceTab = sender?.tab;

    if (sourceTab?.windowId != null && Number.isInteger(sourceTab.index)) {
      void runtime.tabs.create({
        url,
        active,
        windowId: sourceTab.windowId,
        index: sourceTab.index + 1,
      });
      return;
    }

    void runtime.tabs.create({ url, active });
  }

  if (message.type === "navbro.tab.close") {
    void closeActiveTab();
  }

  if (message.type === "navbro.tab.open_after_current") {
    void openTabAfterCurrent();
  }

  if (message.type === "navbro.tab.restore") {
    void restoreClosedTab();
  }

  if (message.type === "navbro.tab.detach") {
    void detachActiveTab();
  }

  if (message.type === "navbro.tab.stop_loading") {
    void stopActiveTabLoading();
  }

  if (message.type === "navbro.tab.zoom") {
    void applyActiveTabZoom(message);
  }
});
