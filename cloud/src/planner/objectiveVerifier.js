import { resolveCurrentState } from "./currentStateResolver.js";

export function evaluateState(objective, resolvedState, observation) {
  const browser = observation?.pageState || observation || {};
  const url = (observation?.url || browser?.url || "").toLowerCase();
  const title = (observation?.title || browser?.title || "").toLowerCase();

  const cleanObjPlatform = (objective.platform || "").toLowerCase().replace(/\.com|\.org|\.net/g, "");
  const cleanResPlatform = (resolvedState.platform || "").toLowerCase().replace(/\.com|\.org|\.net/g, "");

  // Layer 1: Platform Match
  let platformMatch = false;
  if (!cleanObjPlatform || cleanObjPlatform === "generic" || cleanObjPlatform === "blank") {
    platformMatch = true;
  } else {
    platformMatch = (cleanObjPlatform === cleanResPlatform) || url.includes(cleanObjPlatform);
  }

  // Layer 2: URL Match
  let urlMatch = false;
  const desiredState = objective.desiredState;

  if (desiredState === "home") {
    urlMatch = url.length > 0 && (url.endsWith("/") || url.includes("home") || title.includes("home") || (!url.includes("search") && !url.includes("watch") && !url.includes("/results")));
  } else if (desiredState === "results") {
    const env = resolvedState.environment || "generic";
    if (env === "search_site" && url.includes("/search")) urlMatch = true;
    else if (env === "media_site" && (url.includes("/results") || url.includes("search_query") || url.includes("/search"))) urlMatch = true;
    else if (env === "commerce_site" && (url.includes("/s?") || url.includes("/s/") || url.includes("/search") || url.includes("/results"))) urlMatch = true;
    else if (url.includes("search") || url.includes("results") || url.includes("query")) urlMatch = true;
  } else if (desiredState === "video_playing") {
    urlMatch = url.includes("watch") || url.includes("video") || url.includes("/shorts");
  } else if (desiredState === "navigate") {
    const target = (objective.parameters?.url || "").toLowerCase();
    urlMatch = !target || url.includes(target);
  } else {
    urlMatch = true;
  }

  // Layer 3: Landmark / Element Match
  let landmarkMatch = false;
  const inputs = browser.inputs || [];
  const buttons = browser.buttons || [];
  const links = browser.links || [];

  if (desiredState === "home") {
    const hasHomeLink = links.some(l => l.purpose === "home_link");
    const hasSearchInput = inputs.some(i => i.purpose === "search_input" || i.purpose === "search_launcher");
    const hasResultLinks = links.some(l => ["result_link", "video_link", "product_link"].includes(l.purpose));
    landmarkMatch = (hasHomeLink || hasSearchInput) && !hasResultLinks;
  } else if (desiredState === "results") {
    const hasResultLinks = links.some(l => ["result_link", "video_link", "product_link", "post_link", "search_link"].includes(l.purpose));
    landmarkMatch = hasResultLinks;
  } else if (desiredState === "video_playing") {
    landmarkMatch = buttons.some(b => b.purpose === "media_control") || links.some(l => l.purpose === "video_link" || (l.href && l.href.includes("/watch")));
  } else if (desiredState === "result_selected" || desiredState === "product_details") {
    landmarkMatch = true;
  } else {
    landmarkMatch = true;
  }

  // Layer 4: PageType Match
  const pageTypeMatch = (resolvedState.currentState === desiredState);

  const matched = platformMatch && (urlMatch || landmarkMatch || pageTypeMatch);

  console.log(`[VERIFY]
  Objective: ${desiredState}
  Actual: { platform: "${resolvedState.platform}", state: "${resolvedState.currentState}", url: "${url}" }
  Checks:
    platform_match=${platformMatch}
    url_match=${urlMatch}
    landmark_match=${landmarkMatch}
    pageType_match=${pageTypeMatch}
  Final: ${matched ? "SUCCESS" : "FAIL"}`);

  return {
    matched,
    confidence: matched ? 0.95 : 0.0,
    reason: `PlatformMatch: ${platformMatch}, UrlMatch: ${urlMatch}, LandmarkMatch: ${landmarkMatch}, PageTypeMatch: ${pageTypeMatch}`
  };
}

export function verifyObjectiveState(objective, resolvedState, observation) {
  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") {
    return false; 
  }
  const evalRes = evaluateState(objective, resolvedState, observation);
  return evalRes.matched;
}

export function verifyObjective(objective, observation) {
  const resolved = resolveCurrentState(observation);
  const matched = verifyObjectiveState(objective, resolved, observation);
  if (matched) return true;

  if (objective.desiredState === "goal_completed" || objective.desiredState === "information_extracted") {
    return observation?.success === true;
  }
  return false;
}
