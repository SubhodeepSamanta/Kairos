import { ACTIONS } from "../shared/schemas/action.js";
import {
  detectEvents
}
from "./events.js";

export async function observeAction(action, result) {

  function buildObservation(
    base,
    result
  ) {
  
    return {
      ...base,
  
      events:
        detectEvents(result)
    };
  }
  
  switch (action.type) {

    case ACTIONS.NAVIGATE:

  return buildObservation(
    {
      success:
        result?.success || false,

      expected:
        "page_loaded",

      actual:
        result?.url || "unknown",

      action,

      pageState:
        result.pageState,

      before:
        result?.before,

      after:
        result?.after,

      timestamp:
        new Date().toISOString()
    },
    result
  );

case ACTIONS.READ_UI:

return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "page_read",

    actual:
      result?.title || "unknown",

    pageState:
      result,

    title:
      result?.title,

    url:
      result?.url,

    buttons:
      result?.buttons || [],

    inputs:
      result?.inputs || [],

    links:
      result?.links || [],

    text:
      result?.text || "",

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
case ACTIONS.TYPE:

  return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "text_typed",

    actual:
      result?.text,

    element:
      result?.element,

    pageState:
      result?.pageState,

    before:
      result?.before,

    after:
      result?.after,

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
case ACTIONS.BACK:

  return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "page_changed",

    actual:
      result.after?.url ||
      "unknown",

    pageState:
      result.pageState,

    before:
      result.before,

    after:
      result.after,

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
case ACTIONS.GET_BROWSER_CONTEXT:

  return {
    success: result?.success || false,
    expected: "browser_context",
    actual: result?.title || "unknown",
    url: result?.url,
    action,
    timestamp: new Date().toISOString()
  };
  case ACTIONS.FORWARD:

  return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "page_changed",

    actual:
      result.after?.url ||
      "unknown",

    pageState:
      result.pageState,

    before:
      result.before,

    after:
      result.after,

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
  case ACTIONS.REFRESH:

  return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "page_refreshed",

    actual:
      result.after?.url ||
      "unknown",

    pageState:
      result.pageState,

    before:
      result.before,

    after:
      result.after,

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
case ACTIONS.CLICK:

  const changed =
    result.before?.url !==
      result.after?.url ||

    result.before?.title !==
      result.after?.title;
console.log(
  "CLICK RESULT:",
  JSON.stringify(result, null, 2)
);

return buildObservation(
  {
    success:
      result.success,

    expected:
      "page_changed",

    actual:
      changed
        ? "changed"
        : "unchanged",

    clicked:
      result.clicked,

    pageState:
      result.pageState,

    before:
      result.before,

    after:
      result.after,

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
  case ACTIONS.LIST_TABS:

  return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "tabs_listed",

    actual:
      result?.tabs?.length || 0,

    tabs:
      result?.tabs || [],

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
  case ACTIONS.NEW_TAB:

return buildObservation(
  {
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
  },
  result
);
case ACTIONS.SWITCH_TAB:

  return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "tab_switched",

    actual:
      result?.index,

    index:
      result?.index,

    pageState:
      result?.pageState,

    before:
      result?.before,

    after:
      result?.after,

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
case ACTIONS.PRESS_KEY:

return buildObservation(
  {
    success:
      result?.success || false,

    expected:
      "key_pressed",

    actual:
      result?.key || result?.text,

    key:
      result?.key,

    pageState:
      result?.pageState,

    before:
      result?.before,

    after:
      result?.after,

    action,

    timestamp:
      new Date().toISOString()
  },
  result
);
  case ACTIONS.WAIT:

  return buildObservation(
  {
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
  },
  result
);
  case ACTIONS.EXTRACT_METADATA:

  return buildObservation(
  {
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
  },
  result
);
  case ACTIONS.SCREENSHOT:

  return buildObservation(
  {
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
  },
  result
);
  case ACTIONS.EXTRACT_LINKS:

  return buildObservation(
  {
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
  },
  result
);
  case ACTIONS.SCROLL:

return buildObservation(
  {
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
  },
  result
);
  case ACTIONS.CLOSE_TAB:

  return buildObservation(
  {
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
  },
  result
);
  
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