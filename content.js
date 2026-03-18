(() => {
  const STATE = {
    mode: "nav", // 'nav' | 'pass' | 'hint' | 'input'
    pendingSequence: null,
    pendingTimerId: null,
    debugEntries: [],
    hintSession: null,
    lastInputIndex: null,
    inputAnchorEl: null,
  };

  const BADGE_ID = "navbro-mode-badge";
  const DEBUG_ID = "navbro-debug-panel";
  const INPUT_ANCHOR_CLASS = "navbro-input-anchor";
  const KEY_CONFIG = window.NAVBRO_KEY_CONFIG || {
    modeToggle: { key: "Insert", ctrl: true, alt: false, shift: false, meta: false },
    scroll: {
      step: 120,
      fastStep: 360,
      pageHalfStepFactor: 0.5,
      pageFullStepFactor: 0.9,
      smoothScroll: true,
    },
    keySequence: { timeoutMs: 5000 },
    debug: { maxEntries: 10 },
    hints: {
      alphabetMode: "both",
      alphabets: { left: "asdfqwer", right: "jkl;uiop" },
    },
  };
  const WEBEXT_RUNTIME = typeof browser !== "undefined" ? browser : typeof chrome !== "undefined" ? chrome : null;

  if (document.getElementById(BADGE_ID)) return;

  const badge = document.createElement("div");
  badge.id = BADGE_ID;
  badge.style.position = "fixed";
  badge.style.top = "8px";
  badge.style.right = "8px";
  badge.style.zIndex = "2147483647";
  badge.style.padding = "4px 8px";
  badge.style.borderRadius = "6px";
  badge.style.background = "#111";
  badge.style.color = "#fff";
  badge.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  badge.style.fontSize = "12px";
  badge.style.lineHeight = "1";
  badge.style.opacity = "0.9";
  badge.style.pointerEvents = "none";

  const debugPanel = document.createElement("div");
  debugPanel.id = DEBUG_ID;
  debugPanel.style.position = "fixed";
  debugPanel.style.right = "8px";
  debugPanel.style.bottom = "8px";
  debugPanel.style.zIndex = "2147483647";
  debugPanel.style.minWidth = "260px";
  debugPanel.style.maxWidth = "420px";
  debugPanel.style.maxHeight = "220px";
  debugPanel.style.overflow = "hidden";
  debugPanel.style.padding = "8px";
  debugPanel.style.borderRadius = "8px";
  debugPanel.style.background = "rgba(17, 17, 17, 0.92)";
  debugPanel.style.color = "#f5f5f5";
  debugPanel.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  debugPanel.style.fontSize = "11px";
  debugPanel.style.lineHeight = "1.35";
  debugPanel.style.pointerEvents = "none";
  debugPanel.style.whiteSpace = "pre-wrap";

  const inputAnchorStyle = document.createElement("style");
  inputAnchorStyle.textContent = `
    .${INPUT_ANCHOR_CLASS} {
      outline: 2px solid rgba(122, 189, 255, 0.9) !important;
      outline-offset: 1px !important;
    }
  `;

  const renderModeBadge = () => {
    const isWaitingNext = STATE.pendingSequence !== null;
    const isHint = STATE.mode === "hint";
    const isInput = STATE.mode === "input";
    badge.textContent = STATE.mode;
    badge.style.background = isHint ? "#7cc7e8" : isInput ? "#9ad7a5" : isWaitingNext ? "#f2c48d" : "#111";
    badge.style.color = isHint || isInput || isWaitingNext ? "#1f1f1f" : "#fff";
  };

  const renderDebugPanel = () => {
    debugPanel.textContent = STATE.debugEntries.join("\n");
  };

  const pushDebug = (entry) => {
    STATE.debugEntries.unshift(entry);
    STATE.debugEntries = STATE.debugEntries.slice(0, KEY_CONFIG.debug.maxEntries);
    renderDebugPanel();
  };

  const mountUi = () => {
    if (!document.body) return false;

    if (!document.getElementById(BADGE_ID)) {
      renderModeBadge();
      document.body.appendChild(badge);
    }

    if (!document.getElementById(DEBUG_ID)) {
      renderDebugPanel();
      document.body.appendChild(debugPanel);
    }

    if (!document.head.contains(inputAnchorStyle)) {
      document.head.appendChild(inputAnchorStyle);
    }

    return true;
  };

  const matchesCombo = (event, combo) => {
    return (
      event.key === combo.key &&
      event.ctrlKey === !!combo.ctrl &&
      event.altKey === !!combo.alt &&
      event.shiftKey === !!combo.shift &&
      event.metaKey === !!combo.meta
    );
  };

  const isModifierKey = (key) => {
    return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
  };

  const clearPendingTimer = () => {
    if (STATE.pendingTimerId !== null) {
      clearTimeout(STATE.pendingTimerId);
      STATE.pendingTimerId = null;
    }
  };

  const resetPendingSequence = () => {
    clearPendingTimer();
    STATE.pendingSequence = null;
    renderModeBadge();
  };

  const schedulePendingTimeout = () => {
    clearPendingTimer();
    STATE.pendingTimerId = window.setTimeout(() => {
      if (STATE.pendingSequence === "g") {
        const timeoutSec = KEY_CONFIG.keySequence.timeoutMs / 1000;
        pushDebug(`<timeout ${timeoutSec}sec> -> none, reset`);
        resetPendingSequence();
      }
    }, KEY_CONFIG.keySequence.timeoutMs);
  };

  const toggleMode = () => {
    STATE.mode = STATE.mode === "nav" ? "pass" : "nav";
    resetPendingSequence();
    clearHintSession({ restoreNavMode: false });
    renderModeBadge();
    pushDebug(`mode -> ${STATE.mode}`);
  };

  const scrollByY = (deltaY) => {
    const behavior = KEY_CONFIG.scroll.smoothScroll ? "auto" : "instant";
    window.scrollBy({ top: deltaY, left: 0, behavior });
  };

  const getPageStep = (factor) => {
    return Math.max(1, Math.round(window.innerHeight * factor));
  };

  const scrollToTop = () => {
    const behavior = KEY_CONFIG.scroll.smoothScroll ? "auto" : "instant";
    window.scrollTo({ top: 0, left: 0, behavior });
  };

  const scrollToBottom = () => {
    const behavior = KEY_CONFIG.scroll.smoothScroll ? "auto" : "instant";
    const scrollingEl = document.scrollingElement || document.documentElement || document.body;
    const maxY = Math.max((scrollingEl?.scrollHeight || 0) - window.innerHeight, 0);
    window.scrollTo({ top: maxY, left: 0, behavior });
  };

  const sendRuntimeMessage = (message) => {
    if (!WEBEXT_RUNTIME?.runtime?.sendMessage) {
      pushDebug("runtime_send -> unavailable");
      return;
    }

    try {
      void WEBEXT_RUNTIME.runtime.sendMessage(message);
    } catch {
      pushDebug("runtime_send -> failed");
    }
  };

  const navigateToUrlParent = () => {
    const url = new URL(window.location.href);
    const parts = url.pathname.split("/").filter((part) => part.length > 0);

    if (parts.length > 0) {
      parts.pop();
    }

    const parentPath = parts.length ? `/${parts.join("/")}/` : "/";
    const target = `${url.origin}${parentPath}`;
    window.location.assign(target);
  };

  const navigateToUrlRoot = () => {
    const url = new URL(window.location.href);
    const target = `${url.origin}/`;
    window.location.assign(target);
  };

  const isElementActuallyVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (!element.isConnected) return false;

    // Exclude elements that are structurally hidden.
    if (element.closest("[hidden], [inert], dialog:not([open]), template")) {
      return false;
    }

    let current = element;
    while (current && current !== document.documentElement) {
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
        return false;
      }
      if (Number.parseFloat(style.opacity || "1") === 0) {
        return false;
      }
      current = current.parentElement;
    }

    // Hidden overlay/dialog inputs usually have no client rects.
    return element.getClientRects().length > 0;
  };

  const isImportantInput = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (!isElementActuallyVisible(element)) return false;

    if (element instanceof HTMLTextAreaElement) {
      return !element.disabled && !element.readOnly;
    }

    if (element instanceof HTMLInputElement) {
      if (element.disabled || element.readOnly) return false;
      const type = (element.type || "text").toLowerCase();
      const blocked = new Set(["hidden", "checkbox", "radio", "button", "submit", "reset", "file", "image", "range", "color"]);
      return !blocked.has(type);
    }

    if (element.isContentEditable) {
      return true;
    }

    const role = element.getAttribute("role");
    return role === "textbox";
  };

  const getImportantInputs = () => {
    const candidates = Array.from(document.querySelectorAll("input, textarea, [contenteditable='true'], [role='textbox']"));
    return candidates.filter(isImportantInput);
  };

  const isActiveElementImportantInput = () => {
    return isImportantInput(document.activeElement);
  };

  const setInputAnchor = (element) => {
    if (STATE.inputAnchorEl && STATE.inputAnchorEl !== element) {
      STATE.inputAnchorEl.classList.remove(INPUT_ANCHOR_CLASS);
    }

    STATE.inputAnchorEl = element instanceof HTMLElement ? element : null;
    if (STATE.inputAnchorEl) {
      STATE.inputAnchorEl.classList.add(INPUT_ANCHOR_CLASS);
    }
  };

  const focusAdjacentImportantInput = (direction, label) => {
    const inputs = getImportantInputs();
    if (!inputs.length) {
      pushDebug(`${label} -> no_input`);
      return true;
    }

    const activeIndex = inputs.indexOf(document.activeElement);
    const anchorIndex = inputs.indexOf(STATE.inputAnchorEl);
    const knownIndex = STATE.lastInputIndex ?? -1;
    const baseIndex = activeIndex >= 0 ? activeIndex : anchorIndex >= 0 ? anchorIndex : knownIndex;
    const targetIndex = (baseIndex + direction + inputs.length) % inputs.length;
    const target = inputs[targetIndex];

    target.focus();
    setInputAnchor(target);
    STATE.lastInputIndex = targetIndex;
    pushDebug(`${label} -> focus_input ${targetIndex + 1}/${inputs.length}`);
    return true;
  };

  const focusNextImportantInput = () => {
    return focusAdjacentImportantInput(1, "gi");
  };

  const syncModeWithFocusedInput = () => {
    if (STATE.mode === "pass" || STATE.mode === "hint") {
      return;
    }

    const activeEl = document.activeElement;
    const focusedInput = isImportantInput(activeEl);

    if (focusedInput) {
      setInputAnchor(activeEl);
    }

    if (focusedInput && STATE.mode !== "input") {
      STATE.mode = "input";
      renderModeBadge();
      pushDebug("focus -> mode_input");
      return;
    }

    if (!focusedInput && STATE.mode === "input") {
      STATE.mode = "nav";
      renderModeBadge();
      pushDebug("focus -> mode_nav");
    }
  };

  const getHintAlphabet = (mode = KEY_CONFIG.hints?.alphabetMode || "both") => {
    const leftRaw = KEY_CONFIG.hints?.alphabets?.left || "asdfqwer";
    const rightRaw = KEY_CONFIG.hints?.alphabets?.right || "jkl;uiop";
    const left = leftRaw.split("");
    const right = rightRaw.split("");

    if (mode === "left") {
      return [...new Set(left)].join("");
    }

    if (mode === "right") {
      return [...new Set(right)].join("");
    }

    // Priority: asdf + jkl; first, then qwer + uiop.
    const both = [...left.slice(0, 4), ...right.slice(0, 4), ...left.slice(4), ...right.slice(4)];
    return [...new Set(both)].join("");
  };

  const indexToHintCode = (index, alphabet) => {
    const chars = alphabet.split("");
    const base = chars.length;
    let n = index;
    let code = "";

    do {
      code = chars[n % base] + code;
      n = Math.floor(n / base) - 1;
    } while (n >= 0);

    return code;
  };

  const isElementVisibleForHint = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;

    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number.parseFloat(style.opacity || "1") === 0) return false;

    return true;
  };

  const clearHintSession = (options = {}) => {
    const { restoreNavMode = true } = options;
    const session = STATE.hintSession;
    if (!session) return;

    session.overlay.remove();
    STATE.hintSession = null;

    if (restoreNavMode && STATE.mode === "hint") {
      STATE.mode = "nav";
      renderModeBadge();
    }

    pushDebug("hint -> exit");
  };

  const refreshHintSession = () => {
    const session = STATE.hintSession;
    if (!session) return;

    const typed = session.typed;
    let visibleCount = 0;

    for (const item of session.items) {
      const isVisible = item.code.startsWith(typed);
      item.label.style.display = isVisible ? "block" : "none";
      if (isVisible) visibleCount += 1;
    }

    if (visibleCount === 0) {
      pushDebug(`hint(${typed}) -> none`);
    }
  };

  const activateHint = (item) => {
    const session = STATE.hintSession;
    if (!session) return;

    const action = session.action || "current";
    clearHintSession();

    if (action === "tab-bg" || action === "tab-fg") {
      const href = item.element.href;
      if (!href) {
        pushDebug(`hint -> no_href ${item.code}`);
        return;
      }

      sendRuntimeMessage({
        type: "navbro.link.open_tab",
        url: href,
        active: action === "tab-fg",
      });
      pushDebug(`hint -> open_${action === "tab-fg" ? "fg" : "bg"} ${item.code}`);
      return;
    }

    item.element.focus({ preventScroll: true });
    item.element.click();
    pushDebug(`hint -> open ${item.code}`);
  };

  const startHintSession = (action = "current") => {
    if (!document.body) return false;

    const links = Array.from(document.querySelectorAll("a[href]"));
    const visibleLinks = links.filter(isElementVisibleForHint);
    if (!visibleLinks.length) {
      pushDebug("f -> no_links");
      return true;
    }

    const alphabet = getHintAlphabet();
    if (!alphabet.length) {
      pushDebug("f -> no_alphabet");
      return true;
    }

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.left = "0";
    overlay.style.top = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "2147483646";
    overlay.style.pointerEvents = "none";

    const items = visibleLinks.map((element, index) => {
      const code = indexToHintCode(index, alphabet);
      const rect = element.getBoundingClientRect();

      const label = document.createElement("div");
      label.textContent = code;
      label.style.position = "fixed";
      label.style.left = `${Math.max(0, Math.round(rect.left))}px`;
      label.style.top = `${Math.max(0, Math.round(rect.top - 10))}px`;
      label.style.padding = "1px 4px";
      label.style.borderRadius = "4px";
      label.style.background = "rgba(248, 209, 128, 0.65)";
      label.style.color = "#121212";
      label.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      label.style.fontSize = "10px";
      label.style.fontWeight = "600";
      label.style.lineHeight = "1.2";
      label.style.textTransform = "lowercase";
      label.style.boxShadow = "0 0 0 1px rgba(17,17,17,0.25)";
      overlay.appendChild(label);

      return { code, element, label };
    });

    document.body.appendChild(overlay);
    STATE.hintSession = { typed: "", items, overlay, alphabet, action };
    STATE.mode = "hint";
    renderModeBadge();
    const actionLabel = action === "tab-fg" ? "T" : action === "tab-bg" ? "F" : "f";
    pushDebug(`${actionLabel} -> hint_mode (${items.length})`);
    return true;
  };

  const handleHintInput = (event) => {
    const session = STATE.hintSession;
    if (!session) return false;

    const key = event.key;
    if (key === "Escape") {
      clearHintSession();
      return true;
    }

    if (key === "Backspace") {
      session.typed = session.typed.slice(0, -1);
      refreshHintSession();
      return true;
    }

    if (key.length !== 1) {
      return true;
    }

    const char = key.toLowerCase();
    if (!session.alphabet.includes(char)) {
      return true;
    }

    session.typed += char;
    refreshHintSession();

    const exact = session.items.find((item) => item.code === session.typed);
    if (exact) {
      activateHint(exact);
      return true;
    }

    return true;
  };

  const handleInputJumpInputOrNav = (event) => {
    if (STATE.mode !== "nav" && STATE.mode !== "input") {
      return false;
    }

    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return false;
    }

    if (event.key === "]") {
      return focusAdjacentImportantInput(1, "Alt-]");
    }

    if (event.key === "[") {
      return focusAdjacentImportantInput(-1, "Alt-[");
    }

    return false;
  };

  const handleNavInput = (event) => {
    const key = event.key;
    const lowerKey = key.length === 1 ? key.toLowerCase() : key;

    if (STATE.pendingSequence === "g") {
      if (isModifierKey(key)) {
        pushDebug(`${key.toLowerCase()}(down)`);
        return false;
      }

      if (key === "g") {
        scrollToTop();
        pushDebug("g -> scroll_top, reset");
        resetPendingSequence();
        return true;
      }

      if (key === "i") {
        focusNextImportantInput();
        resetPendingSequence();
        return true;
      }

      if (key === "u") {
        navigateToUrlParent();
        pushDebug("gu -> url_parent, reset");
        resetPendingSequence();
        return true;
      }

      if (key === "U") {
        navigateToUrlRoot();
        pushDebug("gU -> url_root, reset");
        resetPendingSequence();
        return true;
      }

      pushDebug(`${key} -> none, reset`);
      resetPendingSequence();
      return true;
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (lowerKey === "h") {
        sendRuntimeMessage({ type: "navbro.tab.prev" });
        pushDebug("Alt-h -> tab_prev");
        return true;
      }

      if (lowerKey === "l") {
        sendRuntimeMessage({ type: "navbro.tab.next" });
        pushDebug("Alt-l -> tab_next");
        return true;
      }
    }

    if (event.altKey && event.ctrlKey && !event.metaKey && !event.shiftKey) {
      if (lowerKey === "h") {
        sendRuntimeMessage({ type: "navbro.tab.prev" });
        pushDebug("Ctrl-Alt-h -> tab_prev");
        return true;
      }

      if (lowerKey === "l") {
        sendRuntimeMessage({ type: "navbro.tab.next" });
        pushDebug("Ctrl-Alt-l -> tab_next");
        return true;
      }
    }

    if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
      if (lowerKey === "h") {
        sendRuntimeMessage({ type: "navbro.tab.move_prev" });
        pushDebug("Alt-Shift-h -> tab_move_prev");
        return true;
      }

      if (lowerKey === "l") {
        sendRuntimeMessage({ type: "navbro.tab.move_next" });
        pushDebug("Alt-Shift-l -> tab_move_next");
        return true;
      }
    }

    if (event.altKey || event.metaKey) {
      return false;
    }

    if (event.ctrlKey && !event.shiftKey) {
      if (lowerKey === "d") {
        scrollByY(getPageStep(KEY_CONFIG.scroll.pageHalfStepFactor));
        pushDebug("Ctrl-d -> page_down_half");
        return true;
      }

      if (lowerKey === "u") {
        scrollByY(-getPageStep(KEY_CONFIG.scroll.pageHalfStepFactor));
        pushDebug("Ctrl-u -> page_up_half");
        return true;
      }

      if (lowerKey === "f") {
        scrollByY(getPageStep(KEY_CONFIG.scroll.pageFullStepFactor));
        pushDebug("Ctrl-f -> page_down_full");
        return true;
      }

      if (lowerKey === "b") {
        scrollByY(-getPageStep(KEY_CONFIG.scroll.pageFullStepFactor));
        pushDebug("Ctrl-b -> page_up_full");
        return true;
      }

      return false;
    }

    if (key === "'") {
      window.history.back();
      pushDebug("' -> history_back");
      return true;
    }

    if (key === "w") {
      sendRuntimeMessage({ type: "navbro.tab.close" });
      pushDebug("w -> tab_close");
      return true;
    }

    if (key === "u") {
      sendRuntimeMessage({ type: "navbro.tab.restore" });
      pushDebug("u -> tab_restore");
      return true;
    }

    if (key === "i") {
      if (isActiveElementImportantInput()) {
        STATE.mode = "input";
        renderModeBadge();
        pushDebug("i -> mode_input");
        return true;
      }

      if (isImportantInput(STATE.inputAnchorEl)) {
        STATE.inputAnchorEl.focus();
        STATE.mode = "input";
        renderModeBadge();
        pushDebug("i -> mode_input(anchor)");
        return true;
      }

      pushDebug("i -> none");
      return true;
    }

    if (key === "g") {
      STATE.pendingSequence = "g";
      renderModeBadge();
      schedulePendingTimeout();
      pushDebug("g -> waiting_next");
      return true;
    }

    if (key === "G") {
      scrollToBottom();
      pushDebug("G -> scroll_bottom");
      return true;
    }

    if (key === "f") {
      return startHintSession("current");
    }

    if (key === "F") {
      return startHintSession("tab-bg");
    }

    if (key === "T") {
      return startHintSession("tab-fg");
    }

    if (key === "j") {
      scrollByY(KEY_CONFIG.scroll.step);
      pushDebug("j -> scroll_down");
      return true;
    }

    if (key === "k") {
      scrollByY(-KEY_CONFIG.scroll.step);
      pushDebug("k -> scroll_up");
      return true;
    }

    if (key === "J") {
      scrollByY(KEY_CONFIG.scroll.fastStep);
      pushDebug("J -> scroll_down_fast");
      return true;
    }

    if (key === "K") {
      scrollByY(-KEY_CONFIG.scroll.fastStep);
      pushDebug("K -> scroll_up_fast");
      return true;
    }

    if (key.length === 1) {
      pushDebug(`${key} -> none`);
      return true;
    }

    return false;
  };

  const onKeyDown = (event) => {
    if (matchesCombo(event, KEY_CONFIG.modeToggle)) {
      event.preventDefault();
      event.stopPropagation();
      toggleMode();
      return;
    }

    if (event.key === "Escape" && STATE.mode !== "pass") {
      event.preventDefault();
      event.stopPropagation();

      resetPendingSequence();
      clearHintSession({ restoreNavMode: false });

      if (STATE.mode === "input") {
        const activeEl = document.activeElement;
        if (isImportantInput(activeEl)) {
          setInputAnchor(activeEl);
        }

        if (activeEl instanceof HTMLElement) {
          activeEl.blur();
        }
      }

      if (STATE.mode !== "nav") {
        STATE.mode = "nav";
        renderModeBadge();
      }

      pushDebug("Esc -> mode_nav");
      return;
    }

    if (handleInputJumpInputOrNav(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (STATE.mode === "pass" || STATE.mode === "input") {
      // Passthrough-like modes: ignore all keys except the mode toggle.
      return;
    }

    if (handleHintInput(event)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (handleNavInput(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onKeyUp = (event) => {
    if (STATE.mode !== "nav") {
      return;
    }

    if (STATE.pendingSequence === "g" && isModifierKey(event.key)) {
      pushDebug(`${event.key.toLowerCase()}(up)`);
    }
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("focusin", syncModeWithFocusedInput, true);

  if (!mountUi()) {
    const observer = new MutationObserver(() => {
      if (mountUi()) {
        syncModeWithFocusedInput();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  } else {
    syncModeWithFocusedInput();
  }
})();
