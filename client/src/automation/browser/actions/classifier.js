export function classifyElement(el, role) {
  let purpose = "generic";
  let confidence = 0.5;

  const text = (el.text || "").toLowerCase();
  const placeholder = (el.placeholder || "").toLowerCase();
  const ariaLabel = (el.ariaLabel || "").toLowerCase();
  const name = (el.name || "").toLowerCase();
  const title = (el.title || "").toLowerCase();
  const href = (el.href || "").toLowerCase();

  const combined = `${text} ${placeholder} ${ariaLabel} ${name} ${title} ${href}`;

  if (role === "input") {
    if ((combined.includes("search") || placeholder.includes("search") || combined.includes("find") || combined.includes("query") || combined.includes("jump to")) && (el.readOnly || el.readonly || combined.includes("readonly"))) {
      purpose = "search_launcher";
      confidence = 0.95;
    } else if (combined.includes("search") || name === "q" || placeholder.includes("find") || placeholder.includes("search") || combined.includes("query")) {
      purpose = "search_input";
      confidence = 0.95;
    } else if (combined.includes("email") && (combined.includes("sign up") || combined.includes("register") || combined.includes("create"))) {
      purpose = "signup_email";
      confidence = 0.9;
    } else if (combined.includes("email") || name.includes("email") || placeholder.includes("email")) {
      purpose = "login_email";
      confidence = 0.85;
    } else if (combined.includes("password") || name.includes("pass") || placeholder.includes("password")) {
      purpose = "login_password";
      confidence = 0.95;
    } else if (combined.includes("job") && combined.includes("title")) {
      purpose = "job_title_input";
      confidence = 0.9;
    } else if (combined.includes("location") || combined.includes("city")) {
      purpose = "location_input";
      confidence = 0.85;
    }
  } else if (role === "button") {
    if (combined.includes("search or jump to") || combined.includes("quick search") || text === "search" || ariaLabel.includes("search button") || placeholder.includes("search")) {
      purpose = "search_launcher";
      confidence = 0.95;
    } else if (combined.includes("close") || combined.includes("dismiss") || combined.includes("cancel") || ariaLabel.includes("close") || title.includes("close")) {
      purpose = "close_button";
      confidence = 0.95;
    } else if (combined.includes("menu") || combined.includes("nav") || combined.includes("hamburger") || combined.includes("options") || ariaLabel.includes("menu")) {
      purpose = "menu_button";
      confidence = 0.9;
    } else if (combined.includes("next") || combined.includes("continue") || combined.includes("forward") || ariaLabel.includes("next")) {
      purpose = "next_button";
      confidence = 0.9;
    } else if (combined.includes("back") || combined.includes("prev") || combined.includes("previous") || ariaLabel.includes("back")) {
      purpose = "back_button";
      confidence = 0.9;
    } else if (combined.includes("download") || combined.includes("export") || ariaLabel.includes("download")) {
      purpose = "download_button";
      confidence = 0.9;
    } else if (combined.includes("filter") || combined.includes("refine") || ariaLabel.includes("filter")) {
      purpose = "filter_button";
      confidence = 0.9;
    } else if (combined.includes("sort") || combined.includes("order by") || ariaLabel.includes("sort")) {
      purpose = "sort_button";
      confidence = 0.9;
    } else if (combined.includes("search") || combined.includes("find")) {
      purpose = "search_button";
      confidence = 0.9;
    } else if (combined.includes("sign in") || combined.includes("login") || combined.includes("log in") || combined.includes("log_in")) {
      purpose = "login_button";
      confidence = 0.95;
    } else if (combined.includes("sign up") || combined.includes("signup") || combined.includes("register") || combined.includes("join")) {
      purpose = "signup_button";
      confidence = 0.95;
    } else if (combined.includes("play") || combined.includes("pause") || combined.includes("stop") || combined.includes("mute") || combined.includes("volume")) {
      purpose = "media_control";
      confidence = 0.9;
    } else if (combined.includes("add to cart") || combined.includes("add to basket") || combined.includes("add-to-cart")) {
      purpose = "add_to_cart_button";
      confidence = 0.95;
    } else if (combined.includes("buy now") || combined.includes("proceed to checkout") || combined.includes("proceed to basket")) {
      purpose = "checkout_button";
      confidence = 0.95;
    } else if (combined.includes("connect") || combined.includes("connect button")) {
      purpose = "connect_button";
      confidence = 0.9;
    } else if (combined.includes("follow") || combined.includes("follow button")) {
      purpose = "follow_button";
      confidence = 0.9;
    } else if (combined.includes("tweet") || combined.includes("post") || combined.includes("share")) {
      purpose = "post_button";
      confidence = 0.85;
    }
  } else if (role === "link") {
    if (combined.includes("home") || combined.includes("logo") || href === "/" || href === "/home") {
      purpose = "home_link";
      confidence = 0.85;
    } else if (combined.includes("profile") || combined.includes("account") || combined.includes("my-profile") || combined.includes("my profile")) {
      purpose = "profile_link";
      confidence = 0.85;
    } else if (combined.includes("search or jump to") || combined.includes("quick search")) {
      purpose = "search_launcher";
      confidence = 0.95;
    } else if (combined.includes("search") || href.includes("search")) {
      purpose = "search_link";
      confidence = 0.8;
    } else if (href.includes("/jobs/") || combined.includes("jobs")) {
      purpose = "jobs_link";
      confidence = 0.9;
    } else if (href.includes("/cart") || href.includes("/basket") || combined.includes("cart")) {
      purpose = "cart_link";
      confidence = 0.9;
    } else if (href.includes("/watch")) {
      purpose = "video_link";
      confidence = 0.9;
    } else if (href.includes("/dp/") || href.includes("/gp/")) {
      purpose = "product_link";
      confidence = 0.9;
    } else if (href.includes("/r/") && href.includes("/comments/")) {
      purpose = "post_link";
      confidence = 0.9;
    } else if (combined.includes("result") || href.includes("/wiki/") || combined.includes("title") || combined.includes("headline")) {
      purpose = "result_link";
      confidence = 0.8;
    }
  }

  return { purpose, confidence };
}

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

  // DOM Landmarks classification (Primary)
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
    // Fallback: URL/Title heuristics
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

  return { site, environment, pageType, legacyPageType: pageType };
}
