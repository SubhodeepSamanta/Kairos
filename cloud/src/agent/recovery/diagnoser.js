import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { understandPage } from "../../world/pageUnderstanding.js";

export function diagnose(lastAction, browserState, previousState = null) {
  if (!browserState) {
    return {
      type: "page loading",
      message: "Browser state is empty, page may still be loading",
      alternative: [{ type: "read_ui", params: {} }]
    };
  }

  const pageText = (browserState.text || "").toLowerCase();
  const pageTitle = (browserState.title || "").toLowerCase();
  const url = (browserState.url || "").toLowerCase();

  // 1. CAPTCHA / Human verification
  if (/captcha|verify you are human/i.test(pageText) || /captcha/i.test(pageTitle)) {
    return {
      type: "authentication required",
      message: "Human verification or CAPTCHA detected",
      escalate: "human_loop",
      reason: "CAPTCHA/Human verification required"
    };
  }

  // 2. Modal Blocking
  const closeBtn = (browserState.buttons || []).find(btn => 
    btn.purpose === "close_button" || 
    (btn.text && /close|dismiss|reject|accept|agree/i.test(btn.text))
  );
  if (closeBtn && (/cookie|consent|privacy|agree/i.test(pageText) || /sign in to/i.test(pageText))) {
    return {
      type: "modal blocking",
      message: `Page interaction blocked by modal or cookie banner: "${closeBtn.text || closeBtn.id}"`,
      alternative: [
        { type: "click", params: { element: closeBtn.id } },
        { type: "read_ui", params: {} }
      ]
    };
  }

  // 3. Stale Content / Empty Page
  if (!browserState.url || browserState.url === "about:blank") {
    return {
      type: "navigation dead end",
      message: "Browser is on a blank page or navigation failed",
      alternative: [
        { type: "navigate", params: { url: "https://www.google.com" } },
        { type: "read_ui", params: {} }
      ]
    };
  }

  // 4. Element Missing / Selector Failed
  if (lastAction && (lastAction.type === "click" || lastAction.type === "type")) {
    const targetElementId = lastAction.params?.element;
    const elements = [...(browserState.inputs || []), ...(browserState.buttons || []), ...(browserState.links || [])];
    const elementExists = elements.some(el => el.id === targetElementId);
    if (!elementExists) {
      return {
        type: "element missing",
        message: `Action target element "${targetElementId}" not found in current DOM`,
        alternative: [
          { type: "scroll", params: { direction: "down", amount: 300 } },
          { type: "read_ui", params: {} }
        ]
      };
    }
  }

  // Default fallback diagnostic
  return {
    type: "stale content",
    message: "Action completed but expected state change not verified",
    alternative: [
      { type: "refresh", params: {} },
      { type: "read_ui", params: {} }
    ]
  };
}
