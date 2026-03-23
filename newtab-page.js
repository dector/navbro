(() => {
  const runtime = typeof browser !== "undefined" ? browser : chrome;
  const storage = runtime?.storage?.local;
  const DEFAULT_TEXT = "Hi!";
  const KEY = "newtabText";

  const normalize = (value) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return DEFAULT_TEXT;
    return text.slice(0, 120);
  };

  const hello = document.getElementById("helloText");
  const settingsBtn = document.getElementById("openSettings");

  if (settingsBtn && runtime?.runtime?.openOptionsPage) {
    settingsBtn.addEventListener("click", () => {
      runtime.runtime.openOptionsPage();
    });
  }

  if (!storage || !hello) return;

  storage
    .get({ [KEY]: DEFAULT_TEXT })
    .then((data) => {
      hello.textContent = normalize(data?.[KEY]);
    })
    .catch(() => {
      hello.textContent = DEFAULT_TEXT;
    });
})();
