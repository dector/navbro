(() => {
  const runtime = typeof browser !== "undefined" ? browser : chrome;
  const storage = runtime?.storage?.local;

  const KEY = "newtabText";
  const DEFAULT_TEXT = "Hi!";
  const MAX_LEN = 120;

  const saveBtn = document.getElementById("saveBtn");
  const backBtn = document.getElementById("backBtn");
  const statusEl = document.getElementById("status");

  const displayBox = document.getElementById("newtabDisplay");
  const displayText = document.getElementById("newtabDisplayText");
  const editorWrap = document.getElementById("newtabEditor");
  const input = document.getElementById("newtabText");
  const resetBtn = document.getElementById("newtabResetBtn");

  let savedValue = DEFAULT_TEXT;
  let draftValue = DEFAULT_TEXT;
  let editing = false;

  const clamp = (value) => (typeof value === "string" ? value.slice(0, MAX_LEN) : "");

  const normalizeStored = (value) => {
    const text = clamp(value).trim();
    return text ? text : DEFAULT_TEXT;
  };

  const setStatus = (text, isOk = false) => {
    statusEl.textContent = text;
    statusEl.classList.toggle("ok", Boolean(isOk));
  };

  const hasUnsavedChanges = () => draftValue !== savedValue;

  const isDifferentFromDefault = () => draftValue !== DEFAULT_TEXT;

  const openEditor = () => {
    editing = true;
    displayBox.classList.add("hidden");
    editorWrap.classList.remove("hidden");
    input.value = draftValue;
    input.focus();
    input.select();
  };

  const closeEditor = () => {
    editing = false;
    editorWrap.classList.add("hidden");
    displayBox.classList.remove("hidden");
  };

  const render = () => {
    displayText.textContent = draftValue;

    const unsaved = hasUnsavedChanges();
    saveBtn.classList.toggle("hidden", !unsaved);
    editorWrap.classList.toggle("unsaved", unsaved);

    resetBtn.classList.toggle("hidden", !isDifferentFromDefault());

    if (!editing) {
      closeEditor();
    }
  };

  const load = async () => {
    if (!storage) {
      setStatus("Storage API unavailable");
      return;
    }

    try {
      const data = await storage.get({ [KEY]: DEFAULT_TEXT });
      const storedText = normalizeStored(data?.[KEY]);
      savedValue = storedText;
      draftValue = storedText;
      setStatus("");
      render();
    } catch {
      savedValue = DEFAULT_TEXT;
      draftValue = DEFAULT_TEXT;
      setStatus("Failed to load settings");
      render();
    }
  };

  const save = async () => {
    if (!storage) {
      setStatus("Storage API unavailable");
      return;
    }

    const nextText = normalizeStored(draftValue);

    try {
      await storage.set({ [KEY]: nextText });
      savedValue = nextText;
      draftValue = nextText;
      input.value = nextText;
      setStatus("Saved", true);
      render();
    } catch {
      setStatus("Failed to save");
    }
  };

  displayBox.addEventListener("click", openEditor);
  displayBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openEditor();
    }
  });

  input.addEventListener("input", () => {
    draftValue = clamp(input.value);
    setStatus("");
    render();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
      displayBox.focus();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      closeEditor();
      displayBox.focus();
    }
  });

  input.addEventListener("blur", () => {
    if (editing) {
      closeEditor();
    }
  });

  saveBtn.addEventListener("click", save);

  resetBtn.addEventListener("click", () => {
    draftValue = DEFAULT_TEXT;
    input.value = DEFAULT_TEXT;
    setStatus("");
    render();
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

  load();
})();
