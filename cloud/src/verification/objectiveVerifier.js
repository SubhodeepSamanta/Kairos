import { resolveCurrentState } from "../world/currentStateResolver.js";
import { normalizeObjective, normalizeResolvedState } from "../world/stateNormalization.js";

export function evaluateState(objective, resolvedState, observation) {
  objective = normalizeObjective(objective);
  resolvedState = normalizeResolvedState(resolvedState);

  const browser = observation?.pageState || observation || {};
  const url = (observation?.url || browser?.url || "").toLowerCase();
  const title = (observation?.title || browser?.title || "").toLowerCase();

  const cleanObjPlatform = (objective.platform || "").toLowerCase().replace(/\s+/g, "").replace(/\.com|\.org|\.net/g, "");
  const cleanResPlatform = (resolvedState.platform || "").toLowerCase().replace(/\s+/g, "").replace(/\.com|\.org|\.net/g, "");

  let platformMatch = false;
  if (!cleanObjPlatform || cleanObjPlatform === "generic" || cleanObjPlatform === "blank") {
    platformMatch = true;
  } else {
    platformMatch = (cleanObjPlatform === cleanResPlatform) || url.replace(/\s+/g, "").includes(cleanObjPlatform);
  }

  let urlMatch = false;
  const desiredState = objective.desiredState;
  const legacyDesiredState = objective.legacyDesiredState;

  if (desiredState === "home") {
    urlMatch = url.length > 0 && (url.endsWith("/") || url.includes("home") || title.includes("home") || (!url.includes("search") && !url.includes("watch") && !url.includes("/results")));
  } else if (desiredState === "results") {
    const env = resolvedState.environment || "generic";
    if (env === "search_site" && url.includes("/search")) urlMatch = true;
    else if (env === "media_site" && (url.includes("/results") || url.includes("search_query") || url.includes("/search"))) urlMatch = true;
    else if (env === "commerce_site" && (url.includes("/s?") || url.includes("/s/") || url.includes("/search") || url.includes("/results"))) urlMatch = true;
    else if (url.includes("search") || url.includes("results") || url.includes("query")) urlMatch = true;
  } else if (desiredState === "content") {
    urlMatch = url.includes("/watch") || url.includes("watch?v=") || url.includes("/shorts/") || url.includes("lofi123");
  } else if (desiredState === "login") {
    urlMatch = url.includes("login") || url.includes("signin") || url.includes("auth") || legacyDesiredState === "logged_in";
  } else if (desiredState === "navigate") {
    const target = (objective.parameters?.url || "").toLowerCase();
    urlMatch = !target || url.includes(target);
  } else if (desiredState === "result_selected" || desiredState === "product_details") {
    urlMatch = (resolvedState.currentState === "content");
  } else {
    urlMatch = true;
  }

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
    landmarkMatch = hasResultLinks && (resolvedState.currentState === "results");
  } else if (desiredState === "content") {
    landmarkMatch = (resolvedState.currentState === "content");
  } else if (desiredState === "login") {
    landmarkMatch = (resolvedState.currentState === "login");
  } else if (desiredState === "result_selected" || desiredState === "product_details") {
    landmarkMatch = (resolvedState.currentState === "content");
  } else {
    landmarkMatch = true;
  }

  const pageTypeMatch = (resolvedState.currentState === desiredState);
  const legacyMatch = platformMatch && (urlMatch || landmarkMatch || pageTypeMatch);

  // Semantic Verification (Step A4)
  let semanticMatch = false;
  const capabilities = browser.capabilities || [];
  const semanticElements = [...inputs, ...buttons, ...links];
  
  if (desiredState === "home") {
    const hasSearchTrigger = semanticElements.some(el => el.semanticType === "search_trigger" || el.semanticType === "search_input");
    const hasContentItems = semanticElements.some(el => el.semanticType === "content_item");
    semanticMatch = (capabilities.includes("navigation_available") || hasSearchTrigger) && !hasContentItems;
  } else if (desiredState === "results") {
    const hasContentItems = semanticElements.some(el => el.semanticType === "content_item" || el.semanticType === "selection_candidate");
    semanticMatch = capabilities.includes("results_available") || hasContentItems;
  } else if (desiredState === "content") {
    const hasMedia = semanticElements.some(el => el.semanticType === "media_element") || capabilities.includes("media_available");
    semanticMatch = hasMedia || resolvedState.semanticState === "media_active" || resolvedState.currentState === "content";
  } else if (desiredState === "login") {
    semanticMatch = resolvedState.semanticState === "authenticated" || !capabilities.includes("authentication_available");
  } else if (desiredState === "navigate") {
    const target = (objective.parameters?.url || "").toLowerCase();
    semanticMatch = !target || url.includes(target);
  } else if (desiredState === "result_selected" || desiredState === "product_details") {
    semanticMatch = (resolvedState.currentState === "content");
  } else {
    semanticMatch = true;
  }

  const finalMatch = legacyMatch || semanticMatch;

  console.log(`[SEMANTIC VERIFY] legacy_matched=${legacyMatch} semantic_matched=${semanticMatch}`);

  console.log(`[VERIFY]
  Objective: ${desiredState}
  Actual: { platform: "${resolvedState.platform}", state: "${resolvedState.currentState}", url: "${url}" }
  Checks:
    platform_match=${platformMatch}
    url_match=${urlMatch}
    landmark_match=${landmarkMatch}
    pageType_match=${pageTypeMatch}
    legacy_match=${legacyMatch}
    semantic_match=${semanticMatch}
  Final: ${finalMatch ? "SUCCESS" : "FAIL"}`);

  return {
    matched: finalMatch,
    confidence: finalMatch ? 0.95 : 0.0,
    reason: `PlatformMatch: ${platformMatch}, LegacyMatch: ${legacyMatch}, SemanticMatch: ${semanticMatch}`
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
