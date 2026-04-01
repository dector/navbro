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
    passOnceToggle: Object.freeze({
      key: "v",
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
    }),
    passMode: Object.freeze({
      defaultHosts: Object.freeze([
        "mail.google.com",
      ]),
    }),
    indicator: Object.freeze({
      passModeVibisibility: "hide-filterlist-only", // 'show-always' | 'hide-always' | 'hide-filterlist-only'
      position: "top-right", // top-left|top-center|top-right|center-left|center-right|bottom-left|bottom-center|bottom-right
    }),
    scroll: Object.freeze({
      step: 120,
      fastStep: 360,
      pageHalfStepFactor: 0.5,
      pageFullStepFactor: 0.9,
      smoothScroll: false,
    }),
    keySequence: Object.freeze({
      timeoutMs: 5000,
    }),
    zoom: Object.freeze({
      step: 0.1,
      strongStep: 0.2,
      min: 0.3,
      max: 3,
      presets: Object.freeze({
        min: 0.5,
        max: 2,
        reset: 1,
      }),
    }),
    youtube: Object.freeze({
      playbackRates: Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]),
      qualityToggle: Object.freeze({
        low: "large", // 480p
        high: "hd1080", // 1080p
      }),
    }),
    debug: Object.freeze({
      maxEntries: 10,
    }),
    hints: Object.freeze({
      alphabetMode: "both", // 'left' | 'right' | 'both'
      displayCovered: false, // show hint labels for elements hidden behind overlays/dialogs
      alphabets: Object.freeze({
        left: "asdfqwer",
        right: "jkl;uiop",
      }),
      selectors: Object.freeze({
        current: "a[href], button, [role='button']",
        tab: "a[href]",
      }),
    }),
  });

  window.NAVBRO_KEY_CONFIG = KEY_CONFIG;
})();
