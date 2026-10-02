const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
function setup(host = "www.youtube.com", hasVideo = true) {
  class HTMLVideoElement { playbackRate = 1; }
  const video = new HTMLVideoElement();
  const context = vm.createContext({
    window: { location: { hostname: host } },
    document: { querySelector: () => hasVideo ? video : null },
    HTMLVideoElement,
  });
  const videoHelpers = source.slice(source.indexOf("  const isYouTubePage ="), source.indexOf("  const ensureYouTubeFocusStyleInjected ="));
  const speedHelper = source.slice(source.indexOf("  const adjustYouTubePlaybackRate ="), source.indexOf("  const ensureYouTubeBridgeInjected ="));
  const handler = source.slice(source.indexOf("  const handleNavInput ="), source.indexOf("  const onKeyDown ="));
  vm.runInContext(`
    const KEY_CONFIG = {};
    const STATE = { pendingSequence: "z" };
    const pushDebug = () => {};
    const showToast = () => {};
    const isModifierKey = () => false;
    const handleTabNavigationHotkeys = () => false;
    const renderModeBadge = () => {};
    const schedulePendingTimeout = () => {};
    const resetPendingSequence = () => { STATE.pendingSequence = null; };
    ${videoHelpers}\n${speedHelper}\n${handler}
    globalThis.api = { STATE, handleNavInput };
  `, context);
  return { ...context.api, video };
}
function press(api, key) {
  api.STATE.pendingSequence = "z";
  const handled = api.handleNavInput({ key });
  assert.equal(api.STATE.pendingSequence, null);
  return handled;
}

test("z] and z[ adjust YouTube speed and clamp at configured limits", () => {
  const api = setup();
  assert.equal(press(api, "]"), true);
  assert.equal(api.video.playbackRate, 1.25);
  assert.equal(press(api, "["), true);
  assert.equal(api.video.playbackRate, 1);
  api.video.playbackRate = 2;
  press(api, "]");
  assert.equal(api.video.playbackRate, 2);
  api.video.playbackRate = 0.5;
  press(api, "[");
  assert.equal(api.video.playbackRate, 0.5);
});

test("uppercase Z prefix supports ZR while Shift stays held", () => {
  const api = setup();
  api.STATE.pendingSequence = null;
  assert.equal(api.handleNavInput({ key: "Z", shiftKey: true }), true);
  assert.equal(api.STATE.pendingSequence, "z");
  assert.equal(api.handleNavInput({ key: "R", shiftKey: true }), true);
  assert.equal(api.video.playbackRate, 0.75);
  assert.equal(api.STATE.pendingSequence, null);
});

test("speed aliases do not run outside YouTube", () => {
  for (const host of ["example.com", "youtube.com.example.com", "notyoutube.com"]) {
    const api = setup(host);
    assert.equal(press(api, "]"), false);
    assert.equal(press(api, "["), false);
    assert.equal(api.video.playbackRate, 1);
  }
});

test("YouTube without a video is handled safely; original bindings still work", () => {
  assert.equal(press(setup("youtube.com", false), "]"), true);
  const api = setup("youtube.com");
  press(api, "r");
  assert.equal(api.video.playbackRate, 1.25);
  press(api, "R");
  assert.equal(api.video.playbackRate, 1);
});
