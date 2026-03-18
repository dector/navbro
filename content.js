(() => {
  const STATE = {
    mode: "nav", // 'nav' | 'pass'
  };

  const BADGE_ID = "navbro-mode-badge";
  const KEY_CONFIG = window.NAVBRO_KEY_CONFIG || {
    modeToggle: { key: "Insert", ctrl: true, alt: false, shift: false, meta: false },
  };

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

  const render = () => {
    badge.textContent = STATE.mode;
  };

  const mountBadge = () => {
    if (document.body && !document.getElementById(BADGE_ID)) {
      render();
      document.body.appendChild(badge);
      return true;
    }
    return false;
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

  const toggleMode = () => {
    STATE.mode = STATE.mode === "nav" ? "pass" : "nav";
    render();
  };

  const handleNavInput = (event) => {
    // Placeholder for future key handling in nav mode.
    // Return true when handled and consumed.
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

  window.addEventListener("keydown", onKeyDown, true);

  if (!mountBadge()) {
    const observer = new MutationObserver(() => {
      if (mountBadge()) observer.disconnect();
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }
})();
