(() => {
  const ID = "navbro-hi-badge";
  if (document.getElementById(ID)) return;

  const badge = document.createElement("div");
  badge.id = ID;
  badge.textContent = "Hi";
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

  const mount = () => {
    if (document.body && !document.getElementById(ID)) {
      document.body.appendChild(badge);
      return true;
    }
    return false;
  };

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement || document, { childList: true, subtree: true });
  }
})();
