export function classifyPage(url, title, elements = {}) {
  const urlLower = (url || "").toLowerCase();
  const titleLower = (title || "").toLowerCase();

  const ENVIRONMENT_MAP = {
    "google.com": "search_site",
    "github.com": "search_site",
    "youtube.com": "media_site",
    "youtu.be": "media_site",
    "amazon.com": "commerce_site",
    "reddit.com": "discussion_site",
    "wikipedia.org": "knowledge_site",
    "linkedin.com": "professional_site",
    "twitter.com": "social_site",
    "x.com": "social_site",
    "instagram.com": "social_site"
  };

  let site = "generic";
  let environment = "generic";

  if (urlLower && urlLower !== "about:blank") {
    try {
      const host = new URL(urlLower).hostname;
      site = host.replace("www.", "").split(".")[0] || "generic";
      const envKey = Object.keys(ENVIRONMENT_MAP).find(key => host.includes(key));
      if (envKey) {
        environment = ENVIRONMENT_MAP[envKey];
      }
    } catch {
      site = "generic";
      environment = "generic";
    }
  }

  const inputs = elements.inputs || [];
  const buttons = elements.buttons || [];
  const links = elements.links || [];

  const hasSearchInput = inputs.some(x => x.purpose === "search_input" || x.purpose === "search_launcher");
  const hasSearchLauncher = buttons.some(x => x.purpose === "search_launcher" || x.purpose === "search_button") ||
                             links.some(x => x.purpose === "search_launcher" || x.purpose === "search_link");
  const hasResultLinks = links.some(x => ["result_link", "video_link", "product_link", "post_link"].includes(x.purpose));
  
  const hasMediaControls = buttons.some(x => x.purpose === "media_control");
  const hasVideoLinks = links.some(x => x.purpose === "video_link");

  const hasPurchaseControls = buttons.some(x => x.purpose === "add_to_cart_button" || x.purpose === "checkout_button");
  const hasProductLinks = links.some(x => x.purpose === "product_link");

  const hasProfileLinks = links.some(x => x.purpose === "profile_link");
  
  const hasAuthInputs = inputs.some(x => ["login_email", "login_password", "signup_email"].includes(x.purpose)) ||
                        buttons.some(x => ["login_button", "signup_button"].includes(x.purpose));

  const hasHomeLink = links.some(x => x.purpose === "home_link");

  let pageType = "content_page";

  const isHomePath = (() => {
    try {
      const path = new URL(urlLower).pathname.replace(/\/+$/, "");
      return path === "" || path === "/" || path === "/home" || path === "/feed" || path === "/main";
    } catch {
      return false;
    }
  })();

  if (isHomePath) {
    pageType = "home_page";
  } else if ((hasSearchInput || hasSearchLauncher) && hasResultLinks) {
    pageType = "result_page";
  } else if (hasMediaControls || hasVideoLinks) {
    pageType = "video_page";
  } else if (hasPurchaseControls || hasProductLinks) {
    pageType = "product_page";
  } else if (hasAuthInputs) {
    pageType = "form_page";
  } else if (urlLower.includes("/in/") || urlLower.includes("/profile") || urlLower.includes("/user/")) {
    pageType = "profile_page";
  } else {
    if (urlLower.includes("/search") || urlLower.includes("/results") || urlLower.includes("search_query")) {
      pageType = "result_page";
    } else if (urlLower.includes("/watch") || urlLower.includes("/shorts") || urlLower.includes("video")) {
      pageType = "video_page";
    } else if (urlLower.includes("/dp/") || urlLower.includes("/gp/product") || urlLower.includes("/jobs")) {
      pageType = "product_page";
    } else if (urlLower.includes("/cart") || urlLower.includes("/gp/cart")) {
      pageType = "form_page";
    } else if (hasHomeLink) {
      pageType = "home_page";
    }
  }

  const isYoutubeResults =
    urlLower.includes("search_query=");

  const isYoutubeWatch =
    urlLower.includes("/watch");

  const isYoutubeShort =
    urlLower.includes("/shorts");

  if (isYoutubeResults)
    pageType = "result_page";

  if (isYoutubeWatch || isYoutubeShort)
    pageType = "video_page";

  const capabilities = ["content_available"];
  if (hasSearchInput || hasSearchLauncher) capabilities.push("search_available");
  if (hasResultLinks) {
    capabilities.push("results_available");
    capabilities.push("selection_available");
  }
  if (hasMediaControls || hasVideoLinks) capabilities.push("media_available");
  if (inputs.length > 0) capabilities.push("form_available");
  if (links.length > 0) capabilities.push("navigation_available");
  if (hasAuthInputs) capabilities.push("authentication_available");

  console.log(`[SEMANTIC CLASSIFIER] pageType="${pageType}" capabilities=${JSON.stringify(capabilities)}`);

  return { site, environment, pageType, legacyPageType: pageType, capabilities };
}
