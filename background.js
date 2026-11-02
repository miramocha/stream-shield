"use strict";

if (browser.storage.session.setAccessLevel) {
  browser.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"
  });
}

let imageSources = [];
let blockImageRequests = false;

function applyImageBlocking(settings) {
  imageSources = settings.imageSources;
  blockImageRequests = settings.enabled && imageSources.length > 0;
}

let imageSourcesReadySettled = false;
const imageSourcesReady = StreamShieldSettings.getSettings()
  .then(applyImageBlocking)
  .catch(() => {})
  .then(() => {
    imageSourcesReadySettled = true;
  });

function cancelBlockedImage(details) {
  if (!blockImageRequests) return undefined;
  if (StreamShieldSettings.imageSourceMatches(details.url, imageSources)) {
    return { cancel: true };
  }
  return undefined;
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (imageSourcesReadySettled) return cancelBlockedImage(details);
    return imageSourcesReady.then(() => cancelBlockedImage(details));
  },
  { urls: ["<all_urls>"], types: ["image", "imageset"] },
  ["blocking"]
);

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" && area !== "session") return;
  if (
    area === "local" &&
    !changes.enabled &&
    !changes.imageSources &&
    !changes.vault
  ) {
    return;
  }
  StreamShieldSettings.getSettings().then(applyImageBlocking);
});

browser.runtime.onInstalled.addListener(async () => {
  const stored = await browser.storage.local.get(null);
  const defaults = {};
  if (typeof stored.enabled !== "boolean") defaults.enabled = true;
  if (!stored.vault && !Array.isArray(stored.terms)) defaults.terms = [];
  if (typeof stored.replacement !== "string") defaults.replacement = "••••••";
  if (!stored.vault && !Array.isArray(stored.imageSources)) defaults.imageSources = [];
  if (Object.keys(defaults).length > 0) {
    await browser.storage.local.set(defaults);
  }
});
