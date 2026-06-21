export function classifyPage(url, title, elements = {}) {
  const urlLower = (url || "").toLowerCase();
  const titleLower = (title || "").toLowerCase();

  let site = "generic";
  let environment = "generic";

  if (urlLower && urlLower !== "about:blank") {
    try {
      const host = new URL(urlLower).hostname;
      site = host.replace("www.", "").split(".")[0] || "generic";
    } catch {
      site = "generic";
    }
  }

  const inputs = elements.inputs || [];
  const buttons = elements.buttons || [];
  const links = elements.links || [];

  const hasSearchInput = inputs.some(x => x.purpose === "search_input" || x.purpose === "navigation_target");
  const hasSearchLauncher = buttons.some(x => x.purpose === "action_target") ||
                             links.some(x => x.purpose === "navigation_target");
  const hasResultLinks = links.some(x => x.purpose === "primary_content");
  
  const hasAuthInputs = inputs.some(x => x.purpose === "form_input") ||
                        buttons.some(x => x.purpose === "action_target" && /sign|log/i.test(x.text || ""));

  let pageType = "generic";

  const isHomePath = (() => {
    try {
      const path = new URL(urlLower).pathname.replace(/\/+$/, "");
      return path === "" || path === "/" || path === "/home" || path === "/feed" || path === "/main";
    } catch {
      return false;
    }
  })();

  const pageText = `${titleLower} ${urlLower}`;

  if (isHomePath) {
    pageType = "search interface";
  } else if ((hasSearchInput || hasSearchLauncher) && hasResultLinks) {
    pageType = "search results";
  } else if (/watch|video|shorts|play|media|live/i.test(pageText)) {
    pageType = "media content";
  } else if (/detail|product|item|dp|wiki/i.test(pageText)) {
    pageType = "content detail";
  } else if (hasAuthInputs || /login|signin|signup|register|auth/i.test(pageText)) {
    pageType = "form";
  } else if (/profile|user|account/i.test(pageText)) {
    pageType = "profile";
  } else if (/settings|config|preferences/i.test(pageText)) {
    pageType = "settings";
  } else if (/dashboard|console|panel/i.test(pageText)) {
    pageType = "dashboard";
  } else if (/jobs|listing|search/i.test(pageText)) {
    pageType = "listing page";
  }

  // Classify environment dynamically
  if (/search|query/i.test(pageText)) {
    environment = "search_site";
  } else if (/video|music|play|watch|stream/i.test(pageText)) {
    environment = "media_site";
  } else if (/shop|buy|cart|checkout|price|store/i.test(pageText)) {
    environment = "commerce_site";
  } else if (/wiki|doc|article|knowledge/i.test(pageText)) {
    environment = "knowledge_site";
  } else if (/job|career|profile|portfolio/i.test(pageText)) {
    environment = "professional_site";
  }

  const capabilities = ["content_available"];
  if (hasSearchInput || hasSearchLauncher) capabilities.push("search_available");
  if (hasResultLinks) {
    capabilities.push("results_available");
    capabilities.push("selection_available");
  }
  if (pageType === "media content") capabilities.push("media_available");
  if (inputs.length > 0) capabilities.push("form_available");
  if (links.length > 0) capabilities.push("navigation_available");
  if (hasAuthInputs) capabilities.push("authentication_available");

  console.log(`[SEMANTIC CLASSIFIER] pageType="${pageType}" capabilities=${JSON.stringify(capabilities)}`);

  return { site, environment, pageType, legacyPageType: pageType, capabilities };
}
