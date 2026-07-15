import { executeDeviceAction } from "./deviceAdapter.js";
import { readPage } from "../automation/browser/actions/observation/read.js";
import { getCurrentPage } from "../automation/browser/browser.js";
import { storeSecret } from "../secrets/vault.js";

const STATE_CHANGING = new Set([
  "navigate", "click", "type", "press_key", "back", "forward", "refresh",
  "switch_tab", "new_tab", "new_window", "close_tab", "scroll", "wait", "use_browser"
]);

const SETTLE_TIMEOUT_MS = 4000;
const SETTLE_PAUSE_MS = 700;

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

  if (STATE_CHANGING.has(action.type)) {
    await settle();
    try {
      observation.page = await readPage();
    } catch (err) {
      console.log(`[EXECUTE] post-action read failed: ${err.message}`);
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
    case "list_browsers":
      return { browsers: result.browsers, installed: result.installed, active: result.active };
    case "use_browser":
      return { browser: result.browser, profile: result.profile, profileLabel: result.profileLabel };
    default:
      return undefined;
  }
}
