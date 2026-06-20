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

  let semanticType = "interactive_control";

  if (purpose === "search_input") {
    semanticType = "search_input";
  } else if (purpose === "search_launcher" || purpose === "search_link" || purpose === "search_button") {
    semanticType = "search_trigger";
  } else if (["video_link", "product_link", "post_link", "result_link"].includes(purpose)) {
    semanticType = "content_item";
  } else if (["login_email", "login_password", "signup_email", "job_title_input", "location_input"].includes(purpose)) {
    semanticType = "input_element";
  } else if (["add_to_cart_button", "checkout_button", "login_button", "signup_button", "post_button"].includes(purpose)) {
    semanticType = "action_button";
  } else if (["home_link", "profile_link"].includes(purpose)) {
    semanticType = "navigation_element";
  } else if (purpose === "media_control") {
    semanticType = "media_element";
  }

  return { purpose, confidence, semanticType };
}
