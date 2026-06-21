export function classifyPage(url, title, elements = {}) {
  const urlLower = (url || "").toLowerCase();
  const titleLower = (title || "").toLowerCase();

  const inputs = elements.inputs || [];
  const buttons = elements.buttons || [];
  const links = elements.links || [];

  const pageText = `${titleLower} ${urlLower}`.toLowerCase();

  let pageType = "generic";

  const hasSearchInput = inputs.some(input => input.purpose === "search_input" || input.purpose === "navigation_target");
  const hasSearchLauncher = buttons.some(button => button.purpose === "action_target") ||
                             links.some(link => link.purpose === "navigation_target");
  const hasResultElements = links.some(link => link.purpose === "primary_content");
  const hasFormInputs = inputs.some(input => input.purpose === "form_input");
  const hasUserContent = buttons.some(button => /submit|continue|next|proceed|go|start/i.test(button.text || "")) ||
                         links.some(link => /read|view|watch|play|consume|article|post|item/i.test(link.text || ""));

  const isHomePath = (() => {
    try {
      const path = new URL(urlLower).pathname.replace(/\/+$/, "");
      return path === "" || path === "/";
    } catch {
      return false;
    }
  })();

  const hasMediaElements = inputs.some(input => /video|audio|media|play|pause|seek|volume/i.test(input.text || "")) ||
                            buttons.some(button => /video|audio|media|play|pause|seek|volume|i.test(button.text || "")) ||
                            links.some(link => /video|audio|media|play|pause|seek|volume|i.test(link.text || ""));

  const hasAuthenticationElements = inputs.some(input => /password|username|login|email|sign/i.test(input.text || "")) ||
                                     buttons.some(button => /sign|log|in|auth/i.test(button.text || "")) ||
                                     /login|signin|signup|auth/i.test(pageText);

  const hasInteractiveFeatures = hasSearchInput || hasSearchLauncher || hasResultElements || hasFormInputs || hasUserContent || hasMediaElements || hasAuthenticationElements;

  if (pageText.includes("article") || pageText.includes("blog") || pageText.includes("post") || pageText.includes("story") || pageText.includes("news") || pageText.length > 1500) {
    pageType = "content_presentation";
  } else if (hasSearchInput || hasSearchLauncher || (hasInteractiveFeatures && isHomePath)) {
    pageType = "content_discovery";
  } else if (hasMediaElements) {
    pageType = "media_interaction";
  } else if (hasFormInputs && hasAuthenticationElements) {
    pageType = "access_control";
  } else if (hasFormInputs && hasResultElements) {
    pageType = "data_interaction";
  } else if (hasResultElements) {
    pageType = "content_selection";
  } else if (hasUserContent) {
    pageType = "interaction_enabling";
  } else if (hasInteractiveFeatures) {
    pageType = "user_interface";
  }

  const environment = detectEnvironment(pageText, hasMediaElements, hasSearchInput, hasFormInputs, hasAuthenticationElements);

  const capabilities = ["content_available"];
  if (hasSearchInput || hasSearchLauncher) capabilities.push("search_available");
  if (hasResultElements) {
    capabilities.push("selection_available");
    capabilities.push("content_consumption");
  }
  if (hasMediaElements) capabilities.push("media_interaction");
  if (hasFormInputs) capabilities.push("data_entry");
  if (hasAuthenticationElements) capabilities.push("access_required");
  if (hasUserContent) capabilities.push("action_facilitation");

  console.log(`[SEMANTIC CLASSIFIER] pageType="${pageType}" capabilities=${JSON.stringify(capabilities)}`);

  return {
    site: "generic",
    environment,
    pageType,
    legacyPageType: pageType,
    capabilities
  };
}

function detectEnvironment(pageText, hasMediaElements, hasSearchInput, hasFormInputs, hasAuthenticationElements) {
  if (hasSearchInput && (pageText.includes("search") || pageText.includes("results") || pageText.includes("find"))) {
    return "search_environment";
  } else if (hasMediaElements && (pageText.includes("video") || pageText.includes("watch") || pageText.includes("play"))) {
    return "media_environment";
  } else if (hasFormInputs && (pageText.includes("form") || pageText.includes("submit") || pageText.includes("login"))) {
    return "interaction_environment";
  } else if (hasAuthenticationElements) {
    return "access_environment";
  } else if (pageText.includes("wiki") || pageText.includes("knowledge") || pageText.includes("help")) {
    return "knowledge_environment";
  }

  return "generic_environment";
}
