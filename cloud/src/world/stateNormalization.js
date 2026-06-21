const STATE_ALIASES = {
  youtube_home: "home",
  youtube_results: "results",
  youtube_video: "content",
  youtube_video_playing: "content",
  video: "content",
  video_playing: "content",
  audio_playing: "content",
  logged_in: "login",
  authenticated: "login",
  auth: "login",
  form_submitted: "login",
  preferences: "settings",
  account_settings: "settings"
};

const GENERIC_STATES = new Set([
  "home",
  "results",
  "content",
  "login",
  "settings",
  "blank",
  "navigate",
  "goal_completed",
  "information_extracted",
  "result_selected",
  "product_details",
  "reach_entry_point",
  "locate_target",
  "interact_with_target",
  "authenticate_user",
  "configure_settings",
  "extract_information",
  "new_tab",
  "switch_tab",
  "close_tab"
]);

export function normalizeStateName(state, platform = "") {
  const raw = (state || "").toLowerCase().trim();
  if (!raw) return "content";

  if (STATE_ALIASES[raw]) return STATE_ALIASES[raw];
  if (GENERIC_STATES.has(raw)) return raw;

  const cleanPlatform = (platform || "").toLowerCase().trim();
  if (cleanPlatform && raw.startsWith(`${cleanPlatform}_`)) {
    return normalizeStateName(raw.slice(cleanPlatform.length + 1), cleanPlatform);
  }

  if (raw.includes("home")) return "home";
  if (raw.includes("result") || raw.includes("search")) return "results";
  if (raw.includes("login") || raw.includes("logged_in") || raw.includes("auth")) return "login";
  if (raw.includes("setting") || raw.includes("preference")) return "settings";
  if (raw.includes("video") || raw.includes("watch") || raw.includes("audio")) return "content";

  return raw;
}

export function normalizeResolvedState(resolvedState = {}) {
  const platform = resolvedState.platform || "generic";
  const legacyState = resolvedState.legacyState || resolvedState.currentState || resolvedState.state;
  const currentState = normalizeStateName(resolvedState.currentState || resolvedState.state, platform);

  return {
    ...resolvedState,
    platform,
    currentState,
    state: currentState,
    legacyState
  };
}

export function normalizeObjective(objective = {}) {
  const platform = objective.platform || "generic";
  const desiredState = normalizeStateName(objective.desiredState || objective.state, platform);

  return {
    ...objective,
    platform,
    desiredState,
    state: desiredState,
    legacyDesiredState: objective.legacyDesiredState || objective.desiredState || objective.state
  };
}

export function normalizeTransition(transition = {}) {
  const normalizedObjective = normalizeObjective({
    platform: transition.platform,
    desiredState: transition.desiredState,
    state: transition.state
  });

  return {
    ...transition,
    platform: normalizedObjective.platform,
    desiredState: normalizedObjective.desiredState,
    state: normalizedObjective.desiredState,
    legacyDesiredState: transition.legacyDesiredState || transition.desiredState || transition.state
  };
}

export function toLegacyCapabilityTransition(transition = {}) {
  const normalized = normalizeTransition(transition);
  let desiredState = normalized.desiredState;

  if (desiredState === "reach_entry_point") {
    desiredState = "home";
  } else if (desiredState === "locate_target") {
    desiredState = "results";
  } else if (desiredState === "interact_with_target") {
    desiredState = normalized.platform === "youtube" ? "video_playing" : "result_selected";
  } else if (desiredState === "authenticate_user") {
    desiredState = "login";
  } else if (desiredState === "configure_settings") {
    desiredState = "settings";
  } else if (desiredState === "extract_information") {
    desiredState = "information_extracted";
  } else if (desiredState === "content") {
    desiredState = normalized.platform === "youtube" ? "video_playing" : "result_selected";
  } else if (desiredState === "login") {
    desiredState = "logged_in";
  } else if (desiredState === "settings") {
    desiredState = "result_selected";
  }

  return {
    ...normalized,
    desiredState,
    state: normalized.desiredState
  };
}

export function transitionId(fromState, toState) {
  return `${normalizeStateName(fromState)}_to_${normalizeStateName(toState)}`;
}
