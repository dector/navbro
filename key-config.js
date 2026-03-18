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
  });

  window.NAVBRO_KEY_CONFIG = KEY_CONFIG;
})();
