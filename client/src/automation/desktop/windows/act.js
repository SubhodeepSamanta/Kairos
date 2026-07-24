import { getDesktopElement } from "../registry.js";
import { bridgeInvoke, bridgeSetValue, bridgeToggle, bridgeSelect, bridgeKeys } from "./uia.js";
import { toSendKeys } from "./keys.js";
import { resolveSecrets } from "../../../secrets/vault.js";

const ACT_TIMEOUT_MS = 8000;

function refFor(id) {
  const el = getDesktopElement(id);
  return el ? { ref: el.ref, name: el.name } : null;
}

function unknown(id) {
  return { success: false, reason: `unknown element ${id} — read_desktop again for fresh ids` };
}

export async function clickElement(id) {
  const el = refFor(id);
  if (!el) return unknown(id);
  try {
    await bridgeInvoke(el.ref, ACT_TIMEOUT_MS);
    return { success: true, id, label: el.name || null };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export async function typeInto(id, rawText, submit = false) {
  const el = refFor(id);
  if (!el) return unknown(id);
  const { resolved, missing, containedSecret } = resolveSecrets(rawText);
  if (missing.length) {
    return { success: false, reason: `missing_secret:${missing.join(",")} — ask the user for it with ask_human and secret_name` };
  }
  try {
    await bridgeSetValue(el.ref, resolved, ACT_TIMEOUT_MS);
    if (submit) await bridgeKeys("{ENTER}", ACT_TIMEOUT_MS);
    return { success: true, id, text: containedSecret ? "•••••" : resolved, submitted: submit === true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export async function setToggle(id, on) {
  const el = refFor(id);
  if (!el) return unknown(id);
  try {
    await bridgeToggle(el.ref, on, ACT_TIMEOUT_MS);
    return { success: true, id, on: on !== false };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export async function selectMenu(id, value) {
  const el = refFor(id);
  if (!el) return unknown(id);
  try {
    await bridgeSelect(el.ref, value, ACT_TIMEOUT_MS);
    return { success: true, id, selected: value };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

export async function pressKeys(keys) {
  const seq = toSendKeys(keys);
  if (!seq) return { success: false, reason: "no keys given" };
  try {
    await bridgeKeys(seq, ACT_TIMEOUT_MS);
    return { success: true, keys };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}
