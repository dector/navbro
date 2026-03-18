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

  if (message.type === "navbro.link.open_tab") {
    const url = typeof message.url === "string" ? message.url : null;
    if (!url) return;

    const active = !!message.active;
    void runtime.tabs.create({ url, active });
  }
});
