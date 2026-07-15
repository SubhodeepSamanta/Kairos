import { detectCaptchaProvider } from "../state/agentSession.js";

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

  const captchaProvider = detectCaptchaProvider(pageText, pageTitle, browserState.inputs, browserState.buttons, browserState.links);
  if (/captcha|verify you are human/i.test(pageText) || /captcha/i.test(pageTitle) || captchaProvider) {
    return {
      type: "authentication required",
      message: `Human verification or CAPTCHA detected${captchaProvider ? ` (${captchaProvider})` : ""}`,
      hypothesis: "The website requires human interaction to bypass bot-detection or verify credentials",
      escalate: "human_loop",
      requiresHumanInput: true,
      reason: "CAPTCHA/Human verification required",
      captchaProvider
    };
  }

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

  if (lastAction && (lastAction.type === "click" || lastAction.type === "type")) {
    const targetElementId = lastAction.params?.element;
    const elements = [...(browserState.inputs || []), ...(browserState.buttons || []), ...(browserState.links || [])];
    const elementExists = elements.some(el => el.id === targetElementId);
    if (!elementExists) {
      const tabs = browserState.tabs || [];
      const hasMultipleTabs = tabs.length > 1;
      if (hasMultipleTabs) {
        return {
          type: "missing element on tab",
          message: `Element "${targetElementId}" not found — may be on a different tab`,
          hypothesis: "Target element exists on another tab",
          alternative: tabs.filter(t => !t.active).map(tab => ({
            type: "switch_tab", params: { index: tab.index }
          })).concat([{ type: "read_ui", params: {} }])
        };
      }
      return {
        type: "missing element",
        message: `Action target element "${targetElementId}" not found`,
        hypothesis: "Element was removed, did not render yet, or is out of view",
        alternative: [
          { type: "scroll", params: { direction: "down", amount: 300 } },
          { type: "read_ui", params: {} }
        ]
      };
    }
  }

  const hasInteractiveElements = [...(browserState.inputs || []), ...(browserState.buttons || []), ...(browserState.links || [])].some(el => el.visible);
  if (!hasInteractiveElements) {
    const tabs = browserState.tabs || [];
    if (tabs.length > 1) {
      return {
        type: "dead end — try other tabs",
        message: "No interactive elements — may be on wrong tab",
        hypothesis: "Interactive content exists on another tab",
        alternative: tabs.filter(t => !t.active).map(tab => ({
          type: "switch_tab", params: { index: tab.index }
        })).concat([{ type: "read_ui", params: {} }])
      };
    }
    return {
      type: "dead end",
      message: "Page has no visible interactive elements",
      hypothesis: "The page may have crashed or loaded blank content",
      alternative: [
        { type: "back", params: {} },
        { type: "read_ui", params: {} }
      ]
    };
  }

  if (previousState && (previousState.url || "").toLowerCase() === url && (previousState.title || "").toLowerCase() === pageTitle) {
    if (retryCount > 1) {
      return {
        type: "no progress",
        message: "Multiple actions executed but browser view unchanged",
        hypothesis: "Action was silent, blocked by hidden state, or ignored by page scripts",
        alternative: [
          { type: "scroll", params: { direction: "down", amount: 300 } },
          { type: "read_ui", params: {} }
        ]
      };
    }
  }

  return {
    type: "stale content",
    message: "Action completed but expected state change not verified",
    hypothesis: "Action may have succeeded silently, or verification conditions are too strict",
    alternative: [{ type: "read_ui", params: {} }]
  };
}
