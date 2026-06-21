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

  const isIconOnly = (!text || text.trim() === "") && (ariaLabel || title);

  if (role === "input") {
    if ((combined.includes("search") || placeholder.includes("search") || combined.includes("find") || combined.includes("query") || combined.includes("jump to")) && (el.readOnly || el.readonly || combined.includes("readonly"))) {
      purpose = "navigation_target";
      confidence = 0.95;
    } else if (combined.includes("search") || name === "q" || placeholder.includes("find") || placeholder.includes("search") || combined.includes("query")) {
      purpose = "search_input";
      confidence = 0.95;
    } else if (combined.includes("email") || name.includes("email") || placeholder.includes("email") || combined.includes("password") || name.includes("pass") || placeholder.includes("password") || combined.includes("job") || combined.includes("location") || combined.includes("city")) {
      purpose = "form_input";
      confidence = 0.9;
    }
  } else if (role === "button") {
    if (combined.includes("search") || combined.includes("find") || text === "search" || ariaLabel.includes("search button") || placeholder.includes("search")) {
      purpose = "action_target";
      confidence = 0.95;
    } else if (combined.includes("close") || combined.includes("dismiss") || combined.includes("cancel") || ariaLabel.includes("close") || title.includes("close") || combined.includes("confirm") || combined.includes("ok") || combined.includes("agree") || combined.includes("accept")) {
      purpose = "confirmation_action";
      confidence = 0.95;
    } else if (combined.includes("menu") || combined.includes("nav") || combined.includes("hamburger") || combined.includes("options") || ariaLabel.includes("menu") || combined.includes("next") || combined.includes("continue") || combined.includes("forward") || combined.includes("back") || combined.includes("prev") || combined.includes("previous") || combined.includes("download") || combined.includes("export") || combined.includes("filter") || combined.includes("refine") || combined.includes("sort") || combined.includes("order by") || combined.includes("sign in") || combined.includes("login") || combined.includes("sign up") || combined.includes("signup") || combined.includes("register") || combined.includes("play") || combined.includes("pause") || combined.includes("stop") || combined.includes("add to cart") || combined.includes("checkout") || combined.includes("connect") || combined.includes("follow") || combined.includes("tweet") || combined.includes("post") || combined.includes("share")) {
      purpose = "action_target";
      confidence = 0.9;
    }
  } else if (role === "link") {
    if (combined.includes("home") || combined.includes("logo") || href === "/" || href === "/home" || combined.includes("profile") || combined.includes("account") || combined.includes("my-profile") || combined.includes("my profile") || combined.includes("cart") || href.includes("cart") || href.includes("basket") || combined.includes("search") || href.includes("search")) {
      purpose = "navigation_target";
      confidence = 0.85;
    } else if (href.includes("/jobs/") || href.includes("/comments/") || href.includes("/watch") || href.includes("/shorts") || href.includes("/live") || href.includes("/dp/") || href.includes("/gp/") || href.includes("/wiki/") || combined.includes("result") || combined.includes("title") || combined.includes("headline")) {
      purpose = "primary_content";
      confidence = 0.9;
    }
  }

  if (isIconOnly && purpose === "generic") {
    confidence = 0.6; // icon-only with a real label is more informative than truly unlabeled generic text
  }

  let semanticType = "interactive_control";

  if (purpose === "search_input") {
    semanticType = "search_input";
  } else if (purpose === "navigation_target") {
    semanticType = "navigation_element";
  } else if (purpose === "primary_content") {
    semanticType = "primary_content";
  } else if (purpose === "form_input") {
    semanticType = "input_element";
  } else if (purpose === "action_target") {
    semanticType = "action_button";
  } else if (purpose === "confirmation_action") {
    semanticType = "confirmation_action";
  }

  return { purpose, confidence, semanticType };
}
