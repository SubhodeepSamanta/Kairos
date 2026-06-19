export function resolveCurrentState(observation, previousResolvedState = null) {
  const browser = observation?.pageState || observation || {};
  const url = (observation?.url || browser?.url || "").toLowerCase();
  const title = (observation?.title || browser?.title || "").toLowerCase();
  
  if ((!url || url === "about:blank") && previousResolvedState) {
    return previousResolvedState;
  }
  
  let platform = "generic";
  let currentState = "content";
  let query = "";

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

  // 1. Identify platform
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
    // Parse name from host
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

  // 2. Identify state & parameters
  if (!url || url === "about:blank") {
    currentState = "blank";
    platform = "generic";
    environment = "generic";
  } else {
    // Check search queries
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
        query = urlObj.searchParams.get("k"); // amazon
      }
    } catch (e) {
      // ignore URL parse error
    }

    const hasResultLinks = (browser.links || []).some(link => 
      ["result_link", "video_link", "product_link", "post_link", "search_link"].includes(link.purpose)
    );
    const hasSearchInput = (browser.inputs || []).some(input => input.purpose === "search_input");

    if (query || url.includes("/search") || url.includes("/results") || pageType.includes("results") || (hasResultLinks && hasSearchInput)) {
      currentState = "results";
    } else if ((platform === "youtube" && (url.includes("/watch") || url.includes("v="))) || pageType.includes("video_playing") || pageType.includes("watch")) {
      currentState = "video_playing";
    } else {
      // Check if homepage (no complex pathname)
      const pathname = urlObj ? urlObj.pathname.split("/").filter(Boolean) : [];
      if (pathname.length === 0 || pageType.includes("home")) {
        currentState = "home";
      } else if (pathname.length === 1 && ["feed", "home", "index.html", "index.php"].includes(pathname[0])) {
        currentState = "home";
      } else {
        currentState = "content";
      }
    }
  }

  return {
    platform,
    environment,
    currentState,
    parameters: {
      query,
      url
    }
  };
}
