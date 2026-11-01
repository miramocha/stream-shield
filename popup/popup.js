"use strict";

const enabledInput = document.querySelector("#enabled");
const statusNode = document.querySelector("#status");
const optionsButton = document.querySelector("#options");

function statusText(settings) {
  if (!settings.enabled) return "Off";
  const count = settings.terms.length;
  if (count === 1) return "On with 1 term";
  return `On with ${count} terms`;
}

function render(settings) {
  enabledInput.checked = settings.enabled;
  statusNode.textContent = statusText(settings);
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

browser.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") load();
});

load();
