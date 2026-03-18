(() => {
  const STATE = {
    mode: "nav", // 'nav' | 'pass'
    pendingSequence: null,
    pendingTimerId: null,
    debugEntries: [],
  };

  const BADGE_ID = "navbro-mode-badge";
  const DEBUG_ID = "navbro-debug-panel";
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

  const renderModeBadge = () => {
    const isWaitingNext = STATE.pendingSequence !== null;
    badge.textContent = STATE.mode;
    badge.style.background = isWaitingNext ? "#f2c48d" : "#111";
    badge.style.color = isWaitingNext ? "#1f1f1f" : "#fff";
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

    if (STATE.mode === "pass") {
      // Passthrough mode: ignore all keys except the mode toggle.
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

  if (!mountUi()) {
    const observer = new MutationObserver(() => {
      if (mountUi()) observer.disconnect();
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }
})();
