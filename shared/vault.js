"use strict";

const StreamShieldVault = (() => {
  const ITERATIONS = 310000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function assertPin(pin) {
    if (!/^\d{4,12}$/.test(String(pin || ""))) {
      throw new Error("Use a PIN of 4 to 12 digits.");
    }
  }

  async function deriveKey(pin, salt, iterations) {
    const material = await crypto.subtle.importKey(
      "raw",
      encoder.encode(String(pin)),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptPayload(pin, payload, iterations = ITERATIONS) {
    assertPin(pin);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pin, salt, iterations);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(payload))
    );
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    return {
      vault: {
        version: 1,
        iterations,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext))
      },
      key: bytesToBase64(raw)
    };
  }

  async function decryptVault(pin, vault) {
    assertPin(pin);
    const key = await deriveKey(pin, base64ToBytes(vault.salt), vault.iterations);
    let plain;
    try {
      plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(vault.iv) },
        key,
        base64ToBytes(vault.ciphertext)
      );
    } catch (error) {
      throw new Error("Incorrect PIN.");
    }
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    return {
      payload: JSON.parse(decoder.decode(plain)),
      key: bytesToBase64(raw)
    };
  }

  async function encryptWithKey(keyBase64, payload) {
    const key = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(keyBase64),
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(JSON.stringify(payload))
    );
    return {
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext))
    };
  }

  return {
    ITERATIONS,
    assertPin,
    encryptPayload,
    decryptVault,
    encryptWithKey
  };
})();
