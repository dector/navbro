(() => {
  const runtime = typeof browser !== "undefined" ? browser : chrome;
  const storage = runtime?.storage?.local;
  const KEY = "newtabText";
  const DEFAULT_TEXT = "Hi!";

  const input = document.getElementById("newtabText");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");

  const normalize = (value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return DEFAULT_TEXT;
    return text.slice(0, 120);
  };

  const setStatus = (text, isOk) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("ok", Boolean(isOk));
  };

  const load = async () => {
    if (!storage) {
      setStatus("Storage API unavailable", false);
      return;
    }

    try {
      const data = await storage.get({ [KEY]: DEFAULT_TEXT });
      input.value = normalize(data?.[KEY]);
      setStatus("", false);
    } catch {
      input.value = DEFAULT_TEXT;
      setStatus("Failed to load settings", false);
    }
  };

  saveBtn.addEventListener("click", async () => {
    if (!storage) {
      setStatus("Storage API unavailable", false);
      return;
    }

    const nextText = normalize(input.value);

    try {
      await storage.set({ [KEY]: nextText });
      input.value = nextText;
      setStatus("Saved", true);
    } catch {
      setStatus("Failed to save", false);
    }
  });

  resetBtn.addEventListener("click", async () => {
    if (!storage) {
      setStatus("Storage API unavailable", false);
      return;
    }

    try {
      await storage.set({ [KEY]: DEFAULT_TEXT });
      input.value = DEFAULT_TEXT;
      setStatus("Reset to default", true);
    } catch {
      setStatus("Failed to reset", false);
    }
  });

  load();
})();
