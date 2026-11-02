"use strict";

const form = document.querySelector("#settings");
const enabledInput = document.querySelector("#enabled");
const termsInput = document.querySelector("#terms");
const showTermsInput = document.querySelector("#show-terms");
const termsConcealedNote = document.querySelector("#terms-concealed");
const revealPin = document.querySelector("#reveal-pin");
const revealPinInput = document.querySelector("#reveal-pin-input");
const revealPinSubmit = document.querySelector("#reveal-pin-submit");
const revealPinError = document.querySelector("#reveal-pin-error");
const replacementInput = document.querySelector("#replacement");
const savedNode = document.querySelector("#saved");
const warningNode = document.querySelector("#replacement-warning");
const imageSourceInput = document.querySelector("#image-source-input");
const addImageSourceButton = document.querySelector("#add-image-source");
const imageSourceList = document.querySelector("#image-source-list");
const imageSourceEmpty = document.querySelector("#image-source-empty");
let imageSources = [];
let savedTimer = 0;
let ignoreShowChange = false;

function replacementContainsTerm(settings) {
  const folded = settings.replacement.toLocaleLowerCase();
  if (!folded) return false;
  return settings.terms.some((term) => folded.includes(term.toLocaleLowerCase()));
}

function renderImageSources() {
  imageSourceList.replaceChildren();
  imageSourceEmpty.hidden = imageSources.length > 0;
  imageSources.forEach((prefix, index) => {
    const item = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = prefix;
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => {
      imageSources = imageSources.filter((_, itemIndex) => itemIndex !== index);
      renderImageSources();
    });
    item.append(text, removeButton);
    imageSourceList.append(item);
  });
}

function addImageSource() {
  imageSources = StreamShieldSettings.normalizeImageSources([
    ...imageSources,
    imageSourceInput.value
  ]);
  imageSourceInput.value = "";
  renderImageSources();
  imageSourceInput.focus();
}

function fill(settings) {
  enabledInput.checked = settings.enabled;
  termsInput.value = settings.terms.join("\n");
  replacementInput.value = settings.replacement;
  imageSources = settings.imageSources.slice();
  warningNode.hidden = !replacementContainsTerm(settings);
  renderImageSources();
}

function syncTermsVisibility() {
  const visible = showTermsInput.checked;
  termsInput.hidden = !visible;
  termsConcealedNote.hidden = visible || !revealPin.hidden;
}

function hideRevealPrompt() {
  revealPin.hidden = true;
  revealPinInput.value = "";
  revealPinError.hidden = true;
}

async function confirmRevealPin() {
  revealPinError.hidden = true;
  const pin = revealPinInput.value;
  revealPinInput.value = "";
  try {
    await StreamShieldSettings.unlock(pin);
    hideRevealPrompt();
    ignoreShowChange = true;
    showTermsInput.checked = true;
    ignoreShowChange = false;
    syncTermsVisibility();
    termsInput.focus();
  } catch (error) {
    revealPinError.hidden = false;
    revealPinError.textContent = error.message;
    revealPinInput.focus();
  }
}

function showSaved() {
  savedNode.hidden = false;
  window.clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => {
    savedNode.hidden = true;
  }, 2000);
}

const pinForm = document.querySelector("#pin-form");
const pinTitle = document.querySelector("#pin-title");
const pinNote = document.querySelector("#pin-note");
const pinInput = document.querySelector("#pin");
const pinConfirmInput = document.querySelector("#pin-confirm");
const confirmLabel = document.querySelector("#confirm-label");
const pinError = document.querySelector("#pin-error");
const pinSubmit = document.querySelector("#pin-submit");
const lockButton = document.querySelector("#lock");
const newPinInput = document.querySelector("#new-pin");
const newPinConfirmInput = document.querySelector("#new-pin-confirm");
const changePinButton = document.querySelector("#change-pin");
const pinChanged = document.querySelector("#pin-changed");
const changePinError = document.querySelector("#change-pin-error");

function showPinError(error) {
  pinError.hidden = false;
  pinError.textContent = error.message;
}

function showPinGate(settings) {
  const gated = settings.needsPin || settings.locked;
  pinForm.hidden = !gated;
  form.hidden = gated;
  confirmLabel.hidden = !settings.needsPin;
  pinConfirmInput.hidden = !settings.needsPin;
  pinSubmit.textContent = settings.needsPin ? "Set PIN" : "Unlock";
  pinTitle.textContent = settings.needsPin ? "Set a PIN" : "Unlock";
  pinNote.textContent = settings.needsPin
    ? "Use 4 to 12 digits. The PIN is not saved. Any terms already stored on this device are encrypted when you set it."
    : "Enter your PIN. Terms stay locked after Firefox quits.";
}

async function load() {
  const settings = await StreamShieldSettings.getSettings();
  showPinGate(settings);
  if (!settings.needsPin && !settings.locked) fill(settings);
  else {
    termsInput.value = "";
    imageSources = [];
    renderImageSources();
  }
}

showTermsInput.addEventListener("change", () => {
  if (ignoreShowChange) return;
  if (!showTermsInput.checked) {
    hideRevealPrompt();
    syncTermsVisibility();
    return;
  }
  ignoreShowChange = true;
  showTermsInput.checked = false;
  ignoreShowChange = false;
  syncTermsVisibility();
  revealPin.hidden = false;
  revealPinInput.focus();
});
revealPinSubmit.addEventListener("click", confirmRevealPin);
revealPinInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  confirmRevealPin();
});
syncTermsVisibility();

addImageSourceButton.addEventListener("click", addImageSource);
imageSourceInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  addImageSource();
});

pinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  pinError.hidden = true;
  const pin = pinInput.value;
  const confirmation = pinConfirmInput.value;
  pinInput.value = "";
  pinConfirmInput.value = "";
  try {
    const creating = !pinConfirmInput.hidden;
    const settings = creating
      ? await StreamShieldSettings.createPin(pin, confirmation)
      : await StreamShieldSettings.unlock(pin);
    showPinGate(settings);
    fill(settings);
  } catch (error) {
    showPinError(error);
  }
});

lockButton.addEventListener("click", async () => {
  termsInput.value = "";
  imageSources = [];
  renderImageSources();
  showTermsInput.checked = false;
  hideRevealPrompt();
  syncTermsVisibility();
  showPinGate(await StreamShieldSettings.lock());
});

changePinButton.addEventListener("click", async () => {
  pinChanged.hidden = true;
  changePinError.hidden = true;
  const pin = newPinInput.value;
  const confirmation = newPinConfirmInput.value;
  newPinInput.value = "";
  newPinConfirmInput.value = "";
  try {
    await StreamShieldSettings.changePin(pin, confirmation);
    pinChanged.hidden = false;
  } catch (error) {
    changePinError.hidden = false;
    changePinError.textContent = error.message;
  }
});

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === "local" || area === "session") load();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  imageSources = StreamShieldSettings.normalizeImageSources([
    ...imageSources,
    imageSourceInput.value
  ]);
  const saved = await StreamShieldSettings.saveSettings({
    enabled: enabledInput.checked,
    terms: termsInput.value,
    replacement: replacementInput.value,
    imageSources
  });
  fill(saved);
  showSaved();
});

load();
