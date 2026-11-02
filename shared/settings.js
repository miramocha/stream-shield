"use strict";

const StreamShieldSettings = (() => {
  const DEFAULT_REPLACEMENT = "••••••";
  const DEFAULTS = {
    enabled: true,
    terms: [],
    replacement: DEFAULT_REPLACEMENT,
    imageSources: []
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

  function normalizeImageSources(sources) {
    const list = Array.isArray(sources)
      ? sources
      : typeof sources === "string"
        ? sources.split(/\r?\n/)
        : [];
    const seen = new Set();
    const normalized = [];
    for (const item of list) {
      let prefix = String(item).trim();
      if (!prefix) continue;
      while (prefix.length > "https://".length && prefix.endsWith("/")) {
        prefix = prefix.slice(0, -1);
      }
      const key = prefix.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(prefix);
    }
    return normalized;
  }

  function startsWithBoundary(value, prefix) {
    if (!value.startsWith(prefix)) return false;
    if (value.length === prefix.length) return true;
    const next = value.charAt(prefix.length);
    return next === "/" || next === "?" || next === "#" || next === ":";
  }

  function imageSourceMatches(url, sources) {
    if (!url || !sources || sources.length === 0) return false;
    const folded = String(url).trim().toLocaleLowerCase();
    if (!folded) return false;
    const afterScheme = folded.includes("://")
      ? folded.slice(folded.indexOf("://") + 3)
      : folded;
    return sources.some((prefix) => {
      const needle = String(prefix).toLocaleLowerCase();
      if (!needle) return false;
      return startsWithBoundary(folded, needle) || startsWithBoundary(afterScheme, needle);
    });
  }

  function hasVault(stored) {
    return Boolean(stored.vault && stored.vault.ciphertext && stored.vault.salt);
  }

  async function readLocal() {
    return browser.storage.local.get({
      enabled: true,
      replacement: DEFAULT_REPLACEMENT,
      terms: [],
      imageSources: [],
      vault: null
    });
  }

  async function readSession() {
    return browser.storage.session.get({
      unlocked: false,
      key: "",
      terms: [],
      imageSources: []
    });
  }

  async function getSettings() {
    const stored = await readLocal();
    const session = await readSession();
    const vaultReady = hasVault(stored);
    const unlocked = vaultReady && session.unlocked;
    const terms = unlocked
      ? normalizeTerms(session.terms)
      : vaultReady
        ? []
        : normalizeTerms(stored.terms);
    const imageSources = unlocked
      ? normalizeImageSources(session.imageSources)
      : vaultReady
        ? []
        : normalizeImageSources(stored.imageSources);
    return {
      enabled: Boolean(stored.enabled),
      replacement:
        typeof stored.replacement === "string"
          ? stored.replacement
          : DEFAULT_REPLACEMENT,
      terms,
      imageSources,
      hasVault: vaultReady,
      locked: vaultReady && !session.unlocked,
      needsPin: !vaultReady
    };
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const enabled =
      partial.enabled === undefined ? current.enabled : Boolean(partial.enabled);
    const replacement =
      partial.replacement === undefined
        ? current.replacement
        : normalizeReplacement(partial.replacement);
    await browser.storage.local.set({ enabled, replacement });

    const changesSecrets =
      partial.terms !== undefined || partial.imageSources !== undefined;
    if (!changesSecrets) return getSettings();

    const terms =
      partial.terms === undefined ? current.terms : normalizeTerms(partial.terms);
    const imageSources =
      partial.imageSources === undefined
        ? current.imageSources
        : normalizeImageSources(partial.imageSources);
    const session = await readSession();

    if (!current.hasVault) {
      await browser.storage.local.set({ terms, imageSources });
      return getSettings();
    }
    if (!session.unlocked || !session.key) {
      throw new Error("Unlock with your PIN before saving terms.");
    }

    const stored = await readLocal();
    const sealed = await StreamShieldVault.encryptWithKey(session.key, {
      terms,
      imageSources
    });
    await browser.storage.local.set({
      vault: {
        version: 1,
        iterations: stored.vault.iterations,
        salt: stored.vault.salt,
        iv: sealed.iv,
        ciphertext: sealed.ciphertext
      }
    });
    await browser.storage.local.remove(["terms", "imageSources"]);
    await browser.storage.session.set({
      unlocked: true,
      key: session.key,
      terms,
      imageSources
    });
    return getSettings();
  }

  async function createPin(pin, confirmation) {
    if (String(pin) !== String(confirmation)) {
      throw new Error("PINs do not match.");
    }
    const current = await getSettings();
    if (current.hasVault) throw new Error("A PIN is already set.");
    const payload = {
      terms: current.terms,
      imageSources: current.imageSources
    };
    const sealed = await StreamShieldVault.encryptPayload(pin, payload);
    await browser.storage.local.set({ vault: sealed.vault });
    await browser.storage.local.remove(["terms", "imageSources"]);
    await browser.storage.session.set({
      unlocked: true,
      key: sealed.key,
      terms: payload.terms,
      imageSources: payload.imageSources
    });
    return getSettings();
  }

  async function unlock(pin) {
    const stored = await readLocal();
    if (!hasVault(stored)) throw new Error("Set a PIN in settings first.");
    const opened = await StreamShieldVault.decryptVault(pin, stored.vault);
    const terms = normalizeTerms(opened.payload.terms);
    const imageSources = normalizeImageSources(opened.payload.imageSources);
    await browser.storage.session.set({
      unlocked: true,
      key: opened.key,
      terms,
      imageSources
    });
    return getSettings();
  }

  async function lock() {
    await browser.storage.session.set({
      unlocked: false,
      key: "",
      terms: [],
      imageSources: []
    });
    return getSettings();
  }

  async function changePin(pin, confirmation) {
    if (String(pin) !== String(confirmation)) {
      throw new Error("PINs do not match.");
    }
    const session = await readSession();
    if (!session.unlocked) throw new Error("Unlock before changing the PIN.");
    const payload = {
      terms: normalizeTerms(session.terms),
      imageSources: normalizeImageSources(session.imageSources)
    };
    const sealed = await StreamShieldVault.encryptPayload(pin, payload);
    await browser.storage.local.set({ vault: sealed.vault });
    await browser.storage.local.remove(["terms", "imageSources"]);
    await browser.storage.session.set({
      unlocked: true,
      key: sealed.key,
      terms: payload.terms,
      imageSources: payload.imageSources
    });
    return getSettings();
  }

  return {
    DEFAULTS,
    getSettings,
    saveSettings,
    createPin,
    unlock,
    lock,
    changePin,
    normalizeImageSources,
    imageSourceMatches
  };
})();
