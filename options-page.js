(() => {
  const runtime = typeof browser !== "undefined" ? browser : chrome;
  const storage = runtime?.storage?.local;

  const DEFAULTS = Object.freeze({
    newtabText: "=^_^=",
    indicatorPassModeVibisibility: "hide-filterlist-only",
    indicatorPosition: "top-right",
  });

  const VALID_PASS_MODE_VIBISIBILITY = new Set(["show-always", "hide-always", "hide-filterlist-only"]);
  const VALID_POSITIONS = new Set([
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ]);

  const MAX_LEN = 120;

  const newtabTextEl = document.getElementById("newtabText");
  const passModeVibisibilityEl = document.getElementById("passModeVibisibility");
  const indicatorPositionEl = document.getElementById("indicatorPosition");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const backBtn = document.getElementById("backBtn");
  const statusEl = document.getElementById("status");

  const clampText = (value) => (typeof value === "string" ? value.slice(0, MAX_LEN) : "");

  const normalizeNewtabText = (value) => {
    const text = clampText(value).trim();
    return text || DEFAULTS.newtabText;
  };

  const normalizePassModeVibisibility = (value) => {
    return VALID_PASS_MODE_VIBISIBILITY.has(value) ? value : DEFAULTS.indicatorPassModeVibisibility;
  };

  const normalizePosition = (value) => {
    return VALID_POSITIONS.has(value) ? value : DEFAULTS.indicatorPosition;
  };

  const setStatus = (text, isOk = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("ok", Boolean(isOk));
  };

  const getDraft = () => ({
    newtabText: normalizeNewtabText(newtabTextEl.value),
    indicatorPassModeVibisibility: normalizePassModeVibisibility(passModeVibisibilityEl.value),
    indicatorPosition: normalizePosition(indicatorPositionEl.value),
  });

  const applyToForm = (value) => {
    newtabTextEl.value = value.newtabText;
    passModeVibisibilityEl.value = value.indicatorPassModeVibisibility;
    indicatorPositionEl.value = value.indicatorPosition;
  };

  let saved = { ...DEFAULTS };

  const load = async () => {
    if (!storage) {
      setStatus("Storage API unavailable");
      applyToForm({ ...DEFAULTS });
      return;
    }

    try {
      const data = await storage.get({ ...DEFAULTS });
      saved = {
        newtabText: normalizeNewtabText(data.newtabText),
        indicatorPassModeVibisibility: normalizePassModeVibisibility(data.indicatorPassModeVibisibility),
        indicatorPosition: normalizePosition(data.indicatorPosition),
      };
      applyToForm(saved);
      setStatus("");
    } catch {
      saved = { ...DEFAULTS };
      applyToForm(saved);
      setStatus("Failed to load settings");
    }
  };

  const save = async () => {
    if (!storage) {
      setStatus("Storage API unavailable");
      return;
    }

    const draft = getDraft();
    try {
      await storage.set(draft);
      saved = { ...draft };
      applyToForm(saved);
      setStatus("Saved", true);
    } catch {
      setStatus("Failed to save");
    }
  };

  saveBtn.addEventListener("click", save);

  resetBtn.addEventListener("click", () => {
    applyToForm({ ...DEFAULTS });
    setStatus("Reset to defaults", true);
  });

  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (runtime?.runtime?.openOptionsPage) {
      runtime.runtime.openOptionsPage();
      return;
    }

    window.close();
  });

  newtabTextEl.addEventListener("input", () => {
    newtabTextEl.value = clampText(newtabTextEl.value);
    setStatus("");
  });

  passModeVibisibilityEl.addEventListener("change", () => setStatus(""));
  indicatorPositionEl.addEventListener("change", () => setStatus(""));

  load();
})();
