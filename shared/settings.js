"use strict";

const StreamShieldSettings = (() => {
  const DEFAULT_REPLACEMENT = "••••••";
  const DEFAULTS = {
    enabled: true,
    terms: [],
    replacement: DEFAULT_REPLACEMENT
  };

  function normalizeTerms(terms) {
    const list = Array.isArray(terms)
      ? terms
      : typeof terms === "string"
        ? terms.split(/\r?\n/)
        : [];
    const seen = new Set();
    const normalized = [];
    for (const item of list) {
      const term = String(item).trim();
      if (!term) continue;
      const key = term.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(term);
    }
    return normalized;
  }

  function normalizeReplacement(value) {
    if (typeof value !== "string") return DEFAULT_REPLACEMENT;
    return value.trim();
  }

  async function getSettings() {
    const stored = await browser.storage.local.get(DEFAULTS);
    return {
      enabled: Boolean(stored.enabled),
      terms: normalizeTerms(stored.terms),
      replacement:
        typeof stored.replacement === "string"
          ? stored.replacement
          : DEFAULT_REPLACEMENT
    };
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = {
      enabled:
        partial.enabled === undefined ? current.enabled : Boolean(partial.enabled),
      terms:
        partial.terms === undefined ? current.terms : normalizeTerms(partial.terms),
      replacement:
        partial.replacement === undefined
          ? current.replacement
          : normalizeReplacement(partial.replacement)
    };
    await browser.storage.local.set(next);
    return next;
  }

  return {
    DEFAULTS,
    getSettings,
    saveSettings
  };
})();
