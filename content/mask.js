"use strict";

const MASK_ATTRIBUTES = ["title", "aria-label", "alt", "placeholder"];
const SKIP_SELECTOR = "script, style, noscript, code, pre, input, textarea";

let settings = {
  enabled: true,
  terms: [],
  replacement: "••••••",
  imageSources: []
};
let pattern = null;
let scanQueued = false;
let scanning = false;
let rescan = false;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTermRegex(terms) {
  const parts = (Array.isArray(terms) ? terms : [])
    .map((term) => String(term).trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map(escapeRegExp);
  if (!parts.length) return null;
  return new RegExp(parts.join("|"), "gi");
}

function skippedElement(node) {
  if (!node) return false;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element || typeof element.closest !== "function") return false;
  if (element.closest(SKIP_SELECTOR)) return true;
  return Boolean(element.isContentEditable);
}

function maskValue(value) {
  if (!pattern || value == null || value === "") return value;
  const original = String(value);
  pattern.lastIndex = 0;
  let matched = false;
  const next = original.replace(pattern, () => {
    matched = true;
    return settings.replacement;
  });
  if (!matched || next === original) return original;
  pattern.lastIndex = 0;
  if (pattern.test(next)) return original;
  return next;
}

function maskTextNode(node) {
  if (!settings.enabled || !pattern) return false;
  if (node.nodeType !== Node.TEXT_NODE) return false;
  if (skippedElement(node)) return false;
  const next = maskValue(node.nodeValue);
  if (next === node.nodeValue) return false;
  node.nodeValue = next;
  return true;
}

function maskAttributes(element) {
  if (!settings.enabled || !pattern) return false;
  if (element.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = element.tagName ? element.tagName.toUpperCase() : "";
  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return false;
  let changed = false;
  for (const name of MASK_ATTRIBUTES) {
    if (!element.hasAttribute(name)) continue;
    const current = element.getAttribute(name);
    const next = maskValue(current);
    if (next === current) continue;
    element.setAttribute(name, next);
    changed = true;
  }
  return changed;
}

function srcsetMatches(srcset) {
  if (!srcset) return false;
  return srcset.split(",").some((part) => {
    const url = part.trim().split(/\s+/)[0];
    return StreamShieldSettings.imageSourceMatches(url, settings.imageSources);
  });
}

function escapeCssAttribute(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function imageElementMatches(element) {
  if (!shieldsImages()) return false;
  const srcAttr = element.getAttribute("src") || "";
  const srcsetAttr = element.getAttribute("srcset") || "";
  const absolute = element.currentSrc || element.src || "";
  return (
    StreamShieldSettings.imageSourceMatches(absolute, settings.imageSources) ||
    StreamShieldSettings.imageSourceMatches(srcAttr, settings.imageSources) ||
    srcsetMatches(srcsetAttr)
  );
}

const BLACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'%3E%3Crect width='1' height='1' fill='%23000'/%3E%3C/svg%3E";

function syncImageBlockStyle() {
  const styleId = "stream-shield-image-blocks";
  let style = document.getElementById(styleId);
  if (!shieldsImages()) {
    if (style) style.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    (document.head || document.documentElement).appendChild(style);
  }
  const rules = settings.imageSources.map((prefix) => {
    const escaped = escapeCssAttribute(prefix);
    return `img[src^="${escaped}" i],img[srcset*="${escaped}" i],input[type="image" i][src^="${escaped}" i]{content:url("${BLACK_IMAGE}") !important;background:#000 !important;object-fit:fill !important;color:transparent !important;}`;
  });
  style.textContent = rules.join("");
}

function blockMatchedImage(element) {
  if (!imageElementMatches(element)) return;
  const tag = element.tagName ? element.tagName.toUpperCase() : "";
  if (tag !== "IMG" && tag !== "INPUT") return;
  element.style.setProperty("background-color", "#000", "important");
  element.style.setProperty("object-fit", "fill", "important");
  element.style.setProperty("color", "transparent", "important");
  element.style.setProperty("content", `url("${BLACK_IMAGE}")`, "important");
}

function maskRoot(root) {
  if (!settings.enabled || !root) return;
  if (!pattern && settings.imageSources.length === 0) return;
  const start = root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
  if (!start) return;

  const stack = [{ node: start, allowText: true }];
  while (stack.length > 0) {
    const { node, allowText } = stack.pop();
    if (!node || node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName ? node.tagName.toUpperCase() : "";
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") continue;

    maskAttributes(node);
    if (
      tag === "IMG" ||
      tag === "SOURCE" ||
      (tag === "INPUT" && String(node.type).toLowerCase() === "image")
    ) {
      blockMatchedImage(node);
    }

    const editable = tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
    const childText = allowText && !editable && tag !== "CODE" && tag !== "PRE";
    if (childText) {
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.TEXT_NODE) maskTextNode(child);
      }
    }

    const children = node.children;
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], allowText: childText });
    }
  }
}

function shieldsImages() {
  return settings.enabled && settings.imageSources.length > 0;
}

function scheduleScan() {
  if (!document.body) return;
  if (!settings.enabled || (!pattern && !shieldsImages())) return;
  if (scanning) {
    rescan = true;
    return;
  }
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scanning = true;
    try {
      maskRoot(document.body);
    } finally {
      scanning = false;
      if (rescan) {
        rescan = false;
        scheduleScan();
      }
    }
  });
}

function mutationMatters(mutations) {
  for (const mutation of mutations) {
    if (!skippedElement(mutation.target)) return true;
  }
  return false;
}

function refreshPattern() {
  pattern = settings.enabled ? buildTermRegex(settings.terms) : null;
}

async function loadSettings() {
  settings = await StreamShieldSettings.getSettings();
  refreshPattern();
  syncImageBlockStyle();
  if (settings.enabled && (pattern || shieldsImages())) scheduleScan();
}

function watchMutations() {
  if (!document.documentElement) return;
  const observer = new MutationObserver((mutations) => {
    if (!settings.enabled || (!pattern && !shieldsImages())) return;
    if (!mutationMatters(mutations)) return;
    scheduleScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["src", "srcset"]
  });
}

browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" && area !== "session") return;
  if (
    area === "local" &&
    !changes.enabled &&
    !changes.terms &&
    !changes.replacement &&
    !changes.imageSources &&
    !changes.vault
  ) {
    return;
  }
  loadSettings();
});

watchMutations();
loadSettings().catch((error) => {
  console.error("Stream Shield could not read settings.", error);
});
