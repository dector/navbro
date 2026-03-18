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

const closeActiveTab = async () => {
  const tabs = await runtime.tabs.query({ currentWindow: true, active: true });
  const activeTab = tabs[0];
  if (!activeTab?.id) return;

  await runtime.tabs.remove(activeTab.id);
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

runtime.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") return;

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

  if (message.type === "navbro.link.open_tab") {
    const url = typeof message.url === "string" ? message.url : null;
    if (!url) return;

    const active = !!message.active;
    void runtime.tabs.create({ url, active });
  }

  if (message.type === "navbro.tab.close") {
    void closeActiveTab();
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
