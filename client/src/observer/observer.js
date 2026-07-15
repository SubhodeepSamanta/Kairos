import { ACTIONS } from "../shared/schemas/action.js";
import { detectEvents } from "./events.js";

const withNavState = (r) => ({
  pageState: r?.pageState,
  before: r?.before,
  after: r?.after
});

const OBSERVATION_SPECS = {
  [ACTIONS.NAVIGATE]: (r) => ({
    expected: "page_loaded",
    actual: r?.url || "unknown",
    ...withNavState(r)
  }),
  [ACTIONS.READ_UI]: (r) => ({
    expected: "page_read",
    actual: r?.title || "unknown",
    pageState: r,
    title: r?.title,
    url: r?.url,
    buttons: r?.buttons || [],
    inputs: r?.inputs || [],
    links: r?.links || [],
    text: r?.text || ""
  }),
  [ACTIONS.TYPE]: (r) => ({
    expected: "text_typed",
    actual: r?.text,
    element: r?.element,
    ...withNavState(r)
  }),
  [ACTIONS.BACK]: (r) => ({
    expected: "page_changed",
    actual: r?.after?.url || "unknown",
    ...withNavState(r)
  }),
  [ACTIONS.FORWARD]: (r) => ({
    expected: "page_changed",
    actual: r?.after?.url || "unknown",
    ...withNavState(r)
  }),
  [ACTIONS.REFRESH]: (r) => ({
    expected: "page_refreshed",
    actual: r?.after?.url || "unknown",
    ...withNavState(r)
  }),
  [ACTIONS.CLICK]: (r) => {
    const changed =
      r?.before?.url !== r?.after?.url ||
      r?.before?.title !== r?.after?.title;
    return {
      expected: "page_changed",
      actual: changed ? "changed" : "unchanged",
      clicked: r?.clicked,
      ...withNavState(r)
    };
  },
  [ACTIONS.LIST_TABS]: (r) => ({
    expected: "tabs_listed",
    actual: r?.tabs?.length || 0,
    tabs: r?.tabs || []
  }),
  [ACTIONS.NEW_TAB]: (r) => ({
    expected: "tab_created",
    actual: r?.index,
    index: r?.index
  }),
  [ACTIONS.SWITCH_TAB]: (r) => ({
    expected: "tab_switched",
    actual: r?.index,
    index: r?.index,
    ...withNavState(r)
  }),
  [ACTIONS.CLOSE_TAB]: (r) => ({
    expected: "tab_closed",
    actual: r?.index,
    index: r?.index
  }),
  [ACTIONS.PRESS_KEY]: (r) => ({
    expected: "key_pressed",
    actual: r?.key || r?.text,
    key: r?.key,
    ...withNavState(r)
  }),
  [ACTIONS.WAIT]: (r) => ({
    expected: "wait_completed",
    actual: r?.seconds,
    seconds: r?.seconds
  }),
  [ACTIONS.EXTRACT_METADATA]: (r) => ({
    expected: "metadata_extracted",
    actual: r?.metadata?.title,
    metadata: r?.metadata
  }),
  [ACTIONS.SCREENSHOT]: (r) => ({
    expected: "screenshot_taken",
    actual: r?.path,
    path: r?.path
  }),
  [ACTIONS.EXTRACT_LINKS]: (r) => ({
    expected: "links_extracted",
    actual: `${r?.links?.length || 0} links`,
    links: r?.links || []
  }),
  [ACTIONS.SCROLL]: (r) => ({
    expected: "page_scrolled",
    actual: r?.direction,
    direction: r?.direction
  })
};

export async function observeAction(action, result) {
  if (action.type === ACTIONS.GET_BROWSER_CONTEXT) {
    return {
      success: result?.success || false,
      expected: "browser_context",
      actual: result?.title || "unknown",
      url: result?.url,
      action,
      timestamp: new Date().toISOString()
    };
  }

  const spec = OBSERVATION_SPECS[action.type];
  if (spec) {
    return {
      success: result?.success || false,
      ...spec(result),
      action,
      timestamp: new Date().toISOString(),
      events: detectEvents(result)
    };
  }

  if (result?.success) {
    return {
      success: true,
      expected: "success",
      actual: "success",
      action,
      timestamp: new Date().toISOString()
    };
  }

  return {
    success: false,
    expected: "success",
    actual: "failed",
    reason: result?.reason || "unknown_error",
    action,
    timestamp: new Date().toISOString()
  };
}
