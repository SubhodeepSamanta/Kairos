import { ACTIONS } from "../shared/schemas/action.js";
import { executeDeviceAction } from "./deviceAdapter.js";
import { createSnapshot } from "../automation/browser/actions/snapshot.js";
import { readPage } from "../automation/browser/actions/observation/read.js";
import { getCurrentPage } from "../automation/browser/browser.js";

export async function executePlan(plan) {
  console.log("\n===== EXECUTING PLAN =====");
  console.log(JSON.stringify(plan, null, 2));

  const results = [];

  for (const action of plan.actions) {
    console.log("[ACTION START]");
    console.log(action);
    console.log("\nACTION:", action.type, action.params);

    let pageStateBefore = null;
    if (action.type === ACTIONS.CLICK || action.type === "click") {
      try {
        pageStateBefore = await readPage();
      } catch {}
    }

    const before = await createSnapshot();
    const result = await executeAction(action);

    if (action.type === ACTIONS.PRESS_KEY) {
      const page = getCurrentPage();
      if (page) {
        try {
          await page.waitForLoadState("domcontentloaded", { timeout: 3000 });
        } catch {}
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const after = await createSnapshot();
    result.before = before;
    result.after = after;

    const pageChanged =
      before.url !== after.url ||
      before.title !== after.title ||
      before.tabCount !== after.tabCount ||
      result.newTabOpened === true;

    const forceReadActions = [
      ACTIONS.NAVIGATE,
      ACTIONS.BACK,
      ACTIONS.FORWARD,
      ACTIONS.REFRESH,
      ACTIONS.SWITCH_TAB,
      ACTIONS.PRESS_KEY,
      ACTIONS.TYPE,
      ACTIONS.CLICK,
      "extract_data"
    ];

    const shouldRead = pageChanged || forceReadActions.includes(action.type);

    if (result.success && shouldRead) {
      const page = getCurrentPage();
      if (page) {
        try {
          await page.waitForLoadState("domcontentloaded", { timeout: 3000 });
        } catch {}
      }

      if (action.type === ACTIONS.CLICK || action.type === "click") {
        const maxTimeout = 8000;
        const interval = 250;
        const startTime = Date.now();

        const prevUrl = pageStateBefore?.url || before.url || "";
        const prevPageType = pageStateBefore?.pageType || "";
        const prevSemanticState = pageStateBefore?.semanticState || "";

        console.log(`[SPA WAIT] Start polling. Previous URL: ${prevUrl} | Previous PageType: ${prevPageType} | Previous State: ${prevSemanticState}`);

        let lastReadState = await readPage();
        let currentUrl = lastReadState.url || "";
        let currentPageType = lastReadState.pageType || "";
        let currentSemanticState = lastReadState.semanticState || "";

        while (Date.now() - startTime < maxTimeout) {
          if (
            currentUrl !== prevUrl ||
            currentPageType !== prevPageType ||
            currentSemanticState !== prevSemanticState
          ) {
            console.log(`[SPA WAIT] State change detected! Stopping wait.`);
            break;
          }

          await new Promise(resolve => setTimeout(resolve, interval));
          lastReadState = await readPage();
          currentUrl = lastReadState.url || "";
          currentPageType = lastReadState.pageType || "";
          currentSemanticState = lastReadState.semanticState || "";

          console.log(`[SPA WAIT] Polling...
  Previous URL: ${prevUrl} | Current URL: ${currentUrl}
  Previous PageType: ${prevPageType} | Current PageType: ${currentPageType}
  Previous State: ${prevSemanticState} | Current State: ${currentSemanticState}`);
        }

        result.pageState = lastReadState;
      } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        result.pageState = await readPage();
      }

      console.log("AUTO READ:", action.type, result.pageState?.url);
    }

    console.log("[ACTION RESULT]");
    console.log(result);

    results.push(result);
  }

  return results;
}

async function executeAction(action) {
  try {
    return await executeDeviceAction(action);
  } catch (error) {
    return {
      success: false,
      reason: error.message,
      action
    };
  }
}