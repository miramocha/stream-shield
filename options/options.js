"use strict";

const form = document.querySelector("#settings");
const enabledInput = document.querySelector("#enabled");
const termsInput = document.querySelector("#terms");
const replacementInput = document.querySelector("#replacement");
const savedNode = document.querySelector("#saved");
const warningNode = document.querySelector("#replacement-warning");
let savedTimer = 0;

function replacementContainsTerm(settings) {
  const folded = settings.replacement.toLocaleLowerCase();
  if (!folded) return false;
  return settings.terms.some((term) => folded.includes(term.toLocaleLowerCase()));
}

function fill(settings) {
  enabledInput.checked = settings.enabled;
  termsInput.value = settings.terms.join("\n");
  replacementInput.value = settings.replacement;
  warningNode.hidden = !replacementContainsTerm(settings);
}

function showSaved() {
  savedNode.hidden = false;
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => {
    savedNode.hidden = true;
  }, 2000);
}

async function load() {
  fill(await StreamShieldSettings.getSettings());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const saved = await StreamShieldSettings.saveSettings({
    enabled: enabledInput.checked,
    terms: termsInput.value,
    replacement: replacementInput.value
  });
  fill(saved);
  showSaved();
});

load();
