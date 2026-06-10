import { ACTIONS } from "../shared/schemas/action.js";

export async function observeAction(action, result) {

  switch (action.type) {

    case ACTIONS.NAVIGATE:

      return {
        success: result?.success || false,
        expected: "page_loaded",
        actual: result?.url || "unknown",
        action,
        timestamp: new Date().toISOString()
      };

    case ACTIONS.READ_UI:
      

return {
  success: result?.success || false,
  expected: "page_read",
  actual: result?.title || "unknown",

  title: result?.title,
  url: result?.url,

  buttons: result?.buttons || [],
  inputs: result?.inputs || [],
  links: result?.links || [],

  text: result?.text || "",

  action,
  timestamp: new Date().toISOString()
};
case ACTIONS.GET_BROWSER_CONTEXT:

  return {
    success: result?.success || false,
    expected: "browser_context",
    actual: result?.title || "unknown",
    url: result?.url,
    action,
    timestamp: new Date().toISOString()
  };
  
case ACTIONS.CLICK:

  const changed =

    result.before?.url !==
      result.after?.url ||

    result.before?.title !==
      result.after?.title;

  return {
    success:
      result.success,

    expected:
      "page_changed",

    actual:
      changed
        ? "changed"
        : "unchanged",

    before:
      result.before,

    after:
      result.after,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.LIST_TABS:

  return {
    success: result?.success || false,

    expected: "tabs_listed",

    actual: result?.tabs?.length || 0,

    tabs: result?.tabs || [],

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.NEW_TAB:

  return {
    success:
      result?.success || false,

    expected:
      "tab_created",

    actual:
      result?.index,

    index:
      result?.index,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.SWITCH_TAB:

  return {
    success:
      result?.success || false,

    expected:
      "tab_switched",

    actual:
      result?.index,

    index:
      result?.index,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.PRESS_KEY:

  return {
    success:
      result?.success || false,

    expected:
      "key_pressed",

    actual:
      result?.key,

    key:
      result?.key,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.WAIT:

  return {
    success:
      result?.success || false,

    expected:
      "wait_completed",

    actual:
      result?.seconds,

    seconds:
      result?.seconds,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.EXTRACT_METADATA:

  return {
    success:
      result?.success || false,

    expected:
      "metadata_extracted",

    actual:
      result.metadata.title,

    metadata:
      result.metadata,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.SCREENSHOT:

  return {
    success:
      result?.success || false,

    expected:
      "screenshot_taken",

    actual:
      result?.path,

    path:
      result?.path,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.EXTRACT_LINKS:

  return {
    success:
      result?.success || false,

    expected:
      "links_extracted",

    actual:
      `${result.links.length} links`,

    links:
      result.links,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.SCROLL:

  return {
    success:
      result?.success || false,

    expected:
      "page_scrolled",

    actual:
      result?.direction,

    direction:
      result?.direction,

    action,

    timestamp:
      new Date().toISOString()
  };
  case ACTIONS.CLOSE_TAB:

  return {
    success:
      result?.success || false,

    expected:
      "tab_closed",

    actual:
      result?.index,

    index:
      result?.index,

    action,

    timestamp:
      new Date().toISOString()
  };
  
    default:

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
}