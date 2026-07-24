import { executeDeviceAction } from "./deviceAdapter.js";
import { readPage } from "../automation/browser/actions/observation/read.js";
import { readDesktop } from "../automation/desktop/driver.js";
import { getCurrentPage } from "../automation/browser/browser.js";
import { storeSecret } from "../secrets/vault.js";
import { executeFileAction, FILE_ACTIONS } from "../files/fileActions.js";

const STATE_CHANGING = new Set([
  "navigate", "click", "type", "press_key", "back", "forward", "refresh",
  "switch_tab", "new_tab", "new_window", "close_tab", "scroll", "wait", "use_browser", "select_option"
]);

const DESKTOP_STATE_CHANGING = new Set([
  "click_element", "type_into", "set_toggle", "select_menu", "press_keys"
]);

const SETTLE_TIMEOUT_MS = 4000;
const SETTLE_PAUSE_MS = 700;
const DESKTOP_SETTLE_MS = 450;

async function settle() {
  const page = getCurrentPage();
  if (page) {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: SETTLE_TIMEOUT_MS });
    } catch {}
  }
  await new Promise(r => setTimeout(r, SETTLE_PAUSE_MS));
}

export async function executeAction(action) {
  const isSecret = action.type === "store_secret" || /\{\{secret:/.test(action.params?.text || "");
  console.log(`[EXECUTE] ${action.type}${isSecret ? " (secret redacted)" : " " + JSON.stringify(action.params || {})}`);

  if (action.type === "store_secret") {
    const ok = storeSecret(action.params?.name, action.params?.value);
    return { success: ok, reason: ok ? undefined : "invalid secret name or value" };
  }

  if (FILE_ACTIONS.has(action.type)) {
    try {
      const result = await executeFileAction(action);
      return { success: result.success !== false, reason: result.reason, data: result };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  let result;
  try {
    result = await executeDeviceAction(action);
  } catch (error) {
    result = { success: false, reason: error.message };
  }

  const observation = {
    success: result?.success !== false,
    reason: result?.success === false ? (result.reason || "action failed") : undefined,
    data: extractData(action, result)
  };

  if (action.type === "read_ui") {
    observation.page = result?.success !== false ? result : null;
    observation.success = result?.success !== false;
    if (!observation.success) observation.reason = result?.reason || "read failed";
    return observation;
  }

  if (action.type === "read_desktop") {
    observation.success = result?.success !== false;
    observation.desktop = observation.success ? { text: result.text, window: result.window, count: result.count } : null;
    if (!observation.success) observation.reason = result?.reason || "read_desktop failed";
    return observation;
  }

  if (STATE_CHANGING.has(action.type)) {
    await settle();
    try {
      observation.page = await readPage();
    } catch (err) {
      console.log(`[EXECUTE] post-action read failed: ${err.message}`);
    }
  }

  if (DESKTOP_STATE_CHANGING.has(action.type)) {
    await new Promise(r => setTimeout(r, DESKTOP_SETTLE_MS));
    try {
      const d = await readDesktop();
      if (d?.success) observation.desktop = { text: d.text, window: d.window, count: d.count };
    } catch (err) {
      console.log(`[EXECUTE] post-action desktop read failed: ${err.message}`);
    }
  }

  return observation;
}

function extractData(action, result) {
  if (!result || typeof result !== "object") return undefined;
  switch (action.type) {
    case "screenshot":
      return { path: result.path };
    case "list_tabs":
      return { tabs: result.tabs };
    case "new_tab":
    case "switch_tab":
    case "close_tab":
      return { index: result.index };
    case "type":
      return { typed: result.text, submitted: result.submitted };
    case "click":
      return result.newTabOpened || result.label
        ? { newTabOpened: result.newTabOpened || undefined, label: result.label || undefined }
        : undefined;
    case "select_option":
      return { selected: result.selected };
    case "open_for_user":
      return { opened: result.opened };
    case "close_user_browser":
      return { closed: result.closed, label: result.label };
    case "list_browsers":
      return { browsers: result.browsers, installed: result.installed, active: result.active };
    case "use_browser":
      return { browser: result.browser, profile: result.profile, profileLabel: result.profileLabel };
    case "list_apps":
      return { apps: result.apps };
    case "open_app":
      return { launched: result.launched, note: result.note };
    case "focus_app":
      return { focused: result.focused };
    case "close_app":
      return { closed: result.closed };
    default:
      return undefined;
  }
}
