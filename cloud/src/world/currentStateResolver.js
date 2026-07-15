import { normalizeResolvedState } from "./stateNormalization.js";
import { isDebug } from "../utils/logger.js";

function resolveSemanticPageState(browser, url, pageType) {
  const capabilities = browser.capabilities || [];
  const elements = [...(browser.inputs || []), ...(browser.buttons || []), ...(browser.links || [])];
  const semanticTypes = new Set(elements.map(element => element.semanticType).filter(Boolean));
  const text = `${browser.title || ""} ${browser.text || ""}`.toLowerCase();

  const evidence = `${pageType} ${[...semanticTypes].join(" ")} ${capabilities.join(" ")}`;

  // Prioritize explicit content/detail types
  if (/details|product|item|article|post|view/.test(pageType) || semanticTypes.has("product_item") || semanticTypes.has("repository_item")) {
    return "content detail";
  }
  if (/video|watch|media/.test(evidence) || capabilities.includes("media_available")) {
    return "media content";
  }

  if (/results$|search_results/.test(pageType) || capabilities.includes("results_available")) return "search results";
  
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch (e) {}

  if (/\/search|\/results/.test(pathname)) return "search results";

  if (/checkout|payment/.test(evidence) || semanticTypes.has("checkout_action")) return "form";
  if (/profile/.test(evidence) || semanticTypes.has("profile_content")) return "profile";
  if (/settings|preferences/.test(evidence) || semanticTypes.has("settings_control")) return "settings";
  if (/login|sign.?in|auth/.test(evidence) || capabilities.includes("authentication_available")) return "form";

  if (/\/settings|\/preferences/.test(url)) return "settings";
  if (/\/login|\/signin|\/auth/.test(url)) return "form";
  if (/sign in|log in/.test(text) && browser.inputs?.some(input => input.type === "password")) return "form";
  return "content detail";
}

export function resolveCurrentState(observation, previousResolvedState = null) {
  const pageState = observation?.pageState || observation || {};
  if (isDebug()) {
    console.log("[STATE RESOLVER INPUT]");
    console.log(JSON.stringify({
      title: pageState?.title,
      url: pageState?.url,
      pageType: pageState?.pageType,
      site: pageState?.site,
      activeTab: pageState?.activeTab,
      tabs: pageState?.tabs?.map(t => ({
        title: t.title,
        url: t.url,
        active: t.active
      }))
    }, null, 2));
  }

  const browser = observation?.pageState || observation || {};
  const url = (observation?.url || browser?.url || "").toLowerCase();
  const title = (observation?.title || browser?.title || "").toLowerCase();
  
  if ((!url || url === "about:blank") && previousResolvedState) {
    if (isDebug()) {
      console.log("[STATE RESOLVER OUTPUT]");
      console.log(JSON.stringify(previousResolvedState, null, 2));
    }
    return previousResolvedState;
  }
  
  let platform = "generic";
  let currentState = "content";
  let semanticState = "content_viewing";
  let query = "";
  let isHomeUrl = false;

  // Derive platform dynamically from hostname
  if (url && url !== "about:blank") {
    try {
      const host = new URL(url).hostname;
      platform = host.replace("www.", "").split(".")[0] || "generic";
    } catch (e) {
      platform = "generic";
    }
  }

  const pageType = (browser.pageType || "").toLowerCase();
  if (platform === "generic" && pageType) {
    const parts = pageType.split(/[\_\-]/);
    const platCandidate = parts[0];
    const nonPlatWords = ["home", "results", "content", "login", "settings", "blank", "navigate", "details", "product", "article", "video", "search", "auth", "welcome"];
    if (platCandidate && !nonPlatWords.includes(platCandidate)) {
      platform = platCandidate;
    }
  }

  // Derive environment dynamically
  let environment = observation?.environment || browser?.environment || "generic";
  if (environment === "generic" && platform !== "generic") {
    const p = platform.toLowerCase();
    const u = url.toLowerCase();
    const t = title.toLowerCase();
    const text = (browser.text || "").toLowerCase();

    if (/search|query|find/i.test(u) || /search|find/i.test(t)) {
      environment = "search_site";
    } else if (/video|watch|play|media|music|stream/i.test(u) || /video|play|stream|media/i.test(t) || /watch/i.test(u)) {
      environment = "media_site";
    } else if (/shop|store|buy|price|cart|checkout/i.test(u) || /shop|store|buy|price|cart|checkout/i.test(t) || /add to cart/i.test(text)) {
      environment = "commerce_site";
    } else if (/wiki|article|paper|doc/i.test(u) || /wiki|article|document/i.test(t)) {
      environment = "knowledge_site";
    } else if (/job|career|profile|portfolio/i.test(u) || /job|career|profile/i.test(t)) {
      environment = "professional_site";
    } else {
      environment = "generic";
    }
  }

  if (!url || url === "about:blank") {
    currentState = "blank";
    platform = "generic";
    environment = "generic";
  } else {
    let urlObj;
    try {
      urlObj = new URL(url);
      if (urlObj.searchParams.has("q")) {
        query = urlObj.searchParams.get("q");
      } else if (urlObj.searchParams.has("query")) {
        query = urlObj.searchParams.get("query");
      } else if (urlObj.searchParams.has("search_query")) {
        query = urlObj.searchParams.get("search_query");
      } else if (urlObj.searchParams.has("k")) {
        query = urlObj.searchParams.get("k");
      }
    } catch (e) {
    }

    const hasResultLinks = (browser.links || []).some(
      link =>
        [
          "primary_content",
          "content_item",
          "selection_candidate"
        ].includes(link.semanticType) ||
        link.purpose === "primary_content"
    );
    const hasSearchInput = (browser.inputs || []).some(input => input.purpose === "search_input");

    const pathname = urlObj ? urlObj.pathname.split("/").filter(Boolean) : [];
    const isHomePath = pathname.length === 0 || (pathname.length === 1 && ["feed", "home", "index.html", "index.php"].includes(pathname[0]));
    isHomeUrl = isHomePath || pageType.includes("home");

    const capabilities = browser.capabilities || [];
    semanticState = resolveSemanticPageState(browser, url, pageType);
    if (pageType === "logged_in" || pageType.includes("logged_in")) {
      semanticState = "authenticated";
    } else if (isHomeUrl && !query && semanticState !== "search results") {
      semanticState = "home_active";
    }

    const semanticToLegacy = {
      "authenticated": "login",
      "form": "login",
      "settings": "settings",
      "home_active": "home",
      "search results": "results",
      "media content": "content",
      "content detail": "content",
      "profile": "content"
    };

    if (semanticToLegacy[semanticState]) {
      currentState = semanticToLegacy[semanticState];
    } else {
      if (pageType === "logged_in" || pageType.includes("logged_in")) {
        currentState = "login";
      } else if (isHomeUrl && !query && !url.includes("/search") && !url.includes("/results") && !pageType.includes("results")) {
        currentState = "home";
      } else if (query || url.includes("/search") || url.includes("/results") || pageType.includes("results") || (hasResultLinks && hasSearchInput)) {
        currentState = "results";
      } else {
        currentState = "content";
      }
    }
  }

  const isVideoState = semanticState === "media content" || pageType.includes("video_playing");
  const legacyState = pageType.includes("logged_in")
    ? "logged_in"
    : (isVideoState ? "video_playing" : currentState);

  const resolvedState = {
    platform,
    environment,
    currentState,
    state: currentState,
    legacyState,
    semanticState,
    parameters: {
      query,
      url
    }
  };

  const normalizedResolvedState = normalizeResolvedState(resolvedState);

  const stateChanged = !previousResolvedState ||
    previousResolvedState.currentState !== normalizedResolvedState.currentState ||
    previousResolvedState.platform !== normalizedResolvedState.platform ||
    previousResolvedState.semanticState !== normalizedResolvedState.semanticState;

  if (stateChanged) {
    console.log(`[STATE RESOLVER] platform="${normalizedResolvedState.platform}" currentState="${normalizedResolvedState.currentState}" semanticState="${normalizedResolvedState.semanticState}"`);
  } else if (isDebug()) {
    console.log(`[SEMANTIC STATE] legacyState="${currentState}" semanticState="${semanticState}"`);
  }

  if (isDebug()) {
    console.log("[STATE RESOLVER OUTPUT]");
    console.log(JSON.stringify(normalizedResolvedState, null, 2));
  }

  return normalizedResolvedState;
}
