import { normalizeResolvedState } from "./stateNormalization.js";
import { isDebug } from "../utils/logger.js";

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

  const ENVIRONMENT_MAP = {
    "google": "search_site",
    "github": "search_site",
    "youtube": "media_site",
    "amazon": "commerce_site",
    "reddit": "discussion_site",
    "wikipedia": "knowledge_site",
    "linkedin": "professional_site",
    "twitter": "social_site",
    "x": "social_site",
    "instagram": "social_site"
  };

  if (url.includes("github.com")) {
    platform = "github";
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "youtube";
  } else if (url.includes("amazon.com")) {
    platform = "amazon";
  } else if (url.includes("google.com")) {
    platform = "google";
  } else if (url.includes("linkedin.com")) {
    platform = "linkedin";
  } else if (url && url !== "about:blank") {
    try {
      const host = new URL(url).hostname;
      platform = host.replace("www.", "").split(".")[0] || "generic";
    } catch (e) {
      platform = "generic";
    }
  }

  const pageType = (browser.pageType || "").toLowerCase();
  if (platform === "generic" && pageType) {
    const platforms = ["github", "youtube", "amazon", "google", "linkedin", "instagram", "reddit", "wikipedia"];
    for (const p of platforms) {
      if (pageType.includes(p) || title.includes(p)) {
        platform = p;
        break;
      }
    }
  }

  let environment = observation?.environment || browser?.environment || ENVIRONMENT_MAP[platform] || "generic";

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
        (
          [
            "primary_content",
            "content_item",
            "selection_candidate"
          ].includes(link.semanticType)
        ) &&
        (
          link.href?.includes("/watch") ||
          link.href?.includes("/live") ||
          link.href?.includes("/shorts") ||
          link.purpose === "video_link"
        )
    );
    const hasSearchInput = (browser.inputs || []).some(input => input.purpose === "search_input");

    const pathname = urlObj ? urlObj.pathname.split("/").filter(Boolean) : [];
    const isHomePath = pathname.length === 0 || (pathname.length === 1 && ["feed", "home", "index.html", "index.php"].includes(pathname[0]));
    isHomeUrl = isHomePath || pageType.includes("home");

    const capabilities = browser.capabilities || [];
    semanticState = "content_viewing";
    if (pageType === "logged_in" || pageType.includes("logged_in")) {
      semanticState = "authenticated";
    } else if (isHomeUrl && !query) {
      semanticState = "home_active";
    } else if (capabilities.includes("results_available") || query || url.includes("/search") || url.includes("/results") || pageType.includes("results")) {
      semanticState = "results_viewing";
    } else if (capabilities.includes("media_available") || (platform === "youtube" && (url.includes("/watch") || url.includes("v="))) || pageType.includes("video_playing") || pageType.includes("watch")) {
      semanticState = "media_active";
    } else if (capabilities.includes("authentication_available")) {
      semanticState = "auth_active";
    } else if (capabilities.includes("form_available")) {
      semanticState = "form_active";
    }

    const semanticToLegacy = {
      "authenticated": "login",
      "auth_active": "login",
      "home_active": "home",
      "results_viewing": "results",
      "media_active": "content",
      "form_active": "content"
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

    const legacyState = pageType.includes("logged_in")
      ? "logged_in"
      : (pageType.includes("video_playing") ? "video_playing" : currentState);

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
