"use strict";

browser.runtime.onInstalled.addListener(async () => {
  const stored = await browser.storage.local.get(null);
  const defaults = {};
  if (typeof stored.enabled !== "boolean") defaults.enabled = true;
  if (!Array.isArray(stored.terms)) defaults.terms = [];
  if (typeof stored.replacement !== "string") defaults.replacement = "••••••";
  if (Object.keys(defaults).length > 0) {
    await browser.storage.local.set(defaults);
  }
});
