"use strict";

const enabledInput = document.querySelector("#enabled");
const statusNode = document.querySelector("#status");
const optionsButton = document.querySelector("#options");
const lockButton = document.querySelector("#lock");
const unlockForm = document.querySelector("#unlock-form");
const lockMessage = document.querySelector("#lock-message");
const pinInput = document.querySelector("#pin");
const pinError = document.querySelector("#pin-error");
const unlockButton = document.querySelector("#unlock");

function statusText(settings) {
  if (settings.needsPin) return "Set a PIN in settings";
  if (settings.locked) return "Locked";
  if (!settings.enabled) return "Off";
  const count = settings.terms.length;
  if (count === 1) return "On with 1 term";
  return `On with ${count} terms`;
}

function render(settings) {
  const showUnlock = settings.locked || settings.needsPin;
  unlockForm.hidden = !showUnlock;
  enabledInput.closest(".toggle").hidden = showUnlock;
  lockButton.hidden = showUnlock || !settings.hasVault;
  enabledInput.checked = settings.enabled;
  statusNode.textContent = statusText(settings);
  pinError.hidden = true;
  if (settings.needsPin) {
    lockMessage.textContent = "Set a PIN in settings before terms can be saved.";
    pinInput.hidden = true;
    unlockButton.hidden = true;
  } else if (settings.locked) {
    lockMessage.textContent = "Enter your PIN to unlock.";
    pinInput.hidden = false;
    unlockButton.hidden = false;
  }
}

async function load() {
  render(await StreamShieldSettings.getSettings());
}

enabledInput.addEventListener("change", async () => {
  render(await StreamShieldSettings.saveSettings({ enabled: enabledInput.checked }));
});

optionsButton.addEventListener("click", () => {
  browser.runtime.openOptionsPage();
});

lockButton.addEventListener("click", async () => {
  pinInput.value = "";
  render(await StreamShieldSettings.lock());
});

unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  pinError.hidden = true;
  const pin = pinInput.value;
  pinInput.value = "";
  try {
    render(await StreamShieldSettings.unlock(pin));
  } catch (error) {
    pinError.hidden = false;
    pinError.textContent = error.message;
  }
});

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === "local" || area === "session") load();
});

load();
