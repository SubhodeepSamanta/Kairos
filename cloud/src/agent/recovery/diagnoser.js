import { resolveCurrentState } from "../../world/currentStateResolver.js";
import { understandPage } from "../../world/pageUnderstandingV2.js";

export function diagnose(lastAction, browserState, previousState = null, retryCount = 0) {
  if (!browserState) {
    return {
      type: "page load failure",
      message: "Browser state is empty, page may still be loading or failed to load",
      hypothesis: "Page is loading slowly or network is down",
      alternative: [{ type: "read_ui", params: {} }]
    };
  }

  const pageText = (browserState.text || "").toLowerCase();
  const pageTitle = (browserState.title || "").toLowerCase();
  const url = (browserState.url || "").toLowerCase();

  // 1. CAPTCHA / Human verification / authentication required / auth gate
  if (/captcha|verify you are human/i.test(pageText) || /captcha/i.test(pageTitle)) {
    return {
      type: "authentication required",
      message: "Human verification or CAPTCHA detected",
      hypothesis: "The website requires human interaction to bypass bot-detection or verify credentials",
      escalate: "human_loop",
      requiresHumanInput: true,
      reason: "CAPTCHA/Human verification required"
    };
  }

  // 2. Rate Limit
  if (/rate limit|too many requests|429/i.test(pageText) || /rate limit/i.test(pageTitle)) {
    return {
      type: "rate limit",
      message: "API or page rate limit exceeded",
      hypothesis: "Too many operations performed too quickly. We should wait or pause.",
      alternative: [
        { type: "wait", params: { ms: 5000 } },
        { type: "read_ui", params: {} }
      ]
    };
  }

  // 3. Modal / Popup blocking
  const closeBtn = (browserState.buttons || []).find(btn => 
    btn.purpose === "confirmation_action" || 
    (btn.text && /close|dismiss|reject|accept|agree|ok/i.test(btn.text))
  );
  if (closeBtn && (/cookie|consent|privacy|agree/i.test(pageText) || /sign in to/i.test(pageText))) {
    return {
      type: "blocked modal",
      message: `Interaction blocked by cookie consent or overlay dialog: "${closeBtn.text || closeBtn.id}"`,
      hypothesis: "A cookie consent dialog or promo overlay is blocking click/type paths",
      alternative: [
        { type: "click", params: { element: closeBtn.id } },
        { type: "read_ui", params: {} }
      ]
    };
  }

  // 4. Page load failure / blank page
  if (!browserState.url || browserState.url === "about:blank") {
    return {
      type: "page load failure",
      message: "Browser is on a blank page or page load timed out",
      hypothesis: "Navigation target failed to resolve or server did not respond",
      alternative: [
        { type: "navigate", params: { url: "https://www.google.com" } },
        { type: "read_ui", params: {} }
      ]
    };
  }

  // 5. Missing Element / Selector Failed / Hidden Element
  if (lastAction && (lastAction.type === "click" || lastAction.type === "type")) {
    const targetElementId = lastAction.params?.element;
    const elements = [...(browserState.inputs || []), ...(browserState.buttons || []), ...(browserState.links || [])];
    const elementExists = elements.some(el => el.id === targetElementId);
    if (!elementExists) {
      return {
        type: "missing element",
        message: `Action target element "${targetElementId}" not found in current DOM`,
        hypothesis: "Element was removed, did not render yet, or is located out of view",
        alternative: [
          { type: "scroll", params: { direction: "down", amount: 300 } },
          { type: "read_ui", params: {} }
        ]
      };
    }
  }

  // 6. Dead End / Missing Affordance
  const hasInteractiveElements = [...(browserState.inputs || []), ...(browserState.buttons || []), ...(browserState.links || [])].some(el => el.visible);
  if (!hasInteractiveElements) {
    return {
      type: "dead end",
      message: "Page has no visible interactive elements",
      hypothesis: "The page may have crashed, loaded blank content, or contains no actionable elements",
      alternative: [
        { type: "back", params: {} },
        { type: "read_ui", params: {} }
      ]
    };
  }

  // 7. Stale Page / No Progress / Wrong Page
  if (previousState && previousState.url === url && previousState.title === pageTitle) {
    if (retryCount > 1) {
      return {
        type: "no progress",
        message: "Multiple actions executed but browser view remains unchanged",
        hypothesis: "Action was silent, blocked by hidden state, or ignored by page scripts",
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
    hypothesis: "Action may have succeeded silently, or verification conditions are too strict",
    alternative: [
      { type: "read_ui", params: {} }
    ]
  };
}
