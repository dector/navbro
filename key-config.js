(() => {
  // Keep all keyboard configuration in one place for now.
  const KEY_CONFIG = Object.freeze({
    modeToggle: Object.freeze({
      key: "Insert",
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
    }),
    scroll: Object.freeze({
      step: 120,
      fastStep: 360,
      smoothScroll: false,
    }),
    keySequence: Object.freeze({
      timeoutMs: 5000,
    }),
    debug: Object.freeze({
      maxEntries: 10,
    }),
  });

  window.NAVBRO_KEY_CONFIG = KEY_CONFIG;
})();
