export function resolveCurrentState(observation) {
  const browser = observation?.pageState || observation || {};
  const url = (observation?.url || browser?.url || "").toLowerCase();
  const title = (observation?.title || browser?.title || "").toLowerCase();
  
  let platform = "generic";
  let currentState = "content";
  let query = "";

  // 1. Identify platform
  if (url.includes("github.com")) {
    platform = "github";
  } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
    platform = "youtube";
  } else if (url.includes("amazon.com")) {
    platform = "amazon";
  } else if (url.includes("google.com")) {
    platform = "google";
  } else if (url && url !== "about:blank") {
    // Parse name from host
    try {
      const host = new URL(url).hostname;
      platform = host.replace("www.", "").split(".")[0] || "generic";
    } catch (e) {
      platform = "generic";
    }
  }

  // 2. Identify state & parameters
  if (!url || url === "about:blank") {
    currentState = "blank";
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

    if (query || url.includes("/search") || url.includes("/results")) {
      currentState = "results";
    } else if (platform === "youtube" && (url.includes("/watch") || url.includes("v="))) {
      currentState = "video_playing";
    } else {
      // Check if homepage (no complex pathname)
      const pathname = urlObj ? urlObj.pathname.split("/").filter(Boolean) : [];
      if (pathname.length === 0) {
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
    currentState,
    parameters: {
      query,
      url
    }
  };
}
