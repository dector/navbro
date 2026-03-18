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

runtime.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "navbro.tab.prev") {
    void activateAdjacentTab(-1);
  }

  if (message.type === "navbro.tab.next") {
    void activateAdjacentTab(1);
  }
});
