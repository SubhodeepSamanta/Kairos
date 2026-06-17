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
    if (combined.includes("search") || name === "q" || placeholder.includes("find") || placeholder.includes("search") || combined.includes("query")) {
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
    if (combined.includes("search") || combined.includes("find")) {
      purpose = "search_button";
      confidence = 0.9;
    } else if (combined.includes("sign in") || combined.includes("login") || combined.includes("log in") || combined.includes("log_in")) {
      purpose = "login_button";
      confidence = 0.95;
    } else if (combined.includes("sign up") || combined.includes("signup") || combined.includes("register") || combined.includes("join")) {
      purpose = "signup_button";
      confidence = 0.95;
    } else if (combined.includes("next") || combined.includes("continue") || combined.includes("forward")) {
      purpose = "navigation_button";
      confidence = 0.9;
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
    }
  }

  return { purpose, confidence };
}

export function classifyPage(url, title, elements = {}) {
  const urlLower = (url || "").toLowerCase();
  const titleLower = (title || "").toLowerCase();

  if (urlLower.includes("github.com")) {
    if (urlLower.includes("/search")) {
      return "github_search_results";
    }
    const hasSearchInput = (elements.inputs || []).some(input => input.purpose === "search_input");
    if (hasSearchInput) {
      return "github_search_overlay";
    }
    try {
      const path = new URL(url).pathname;
      if (path === "/" || path === "") {
        return "github_home";
      }
    } catch {}
    return "github_repo";
  }

  if (urlLower.includes("youtube.com")) {
    if (urlLower.includes("/shorts")) {
      return "youtube_shorts";
    }
    if (urlLower.includes("/results")) {
      return "youtube_results";
    }
    if (urlLower.includes("/watch")) {
      return "youtube_video";
    }
    try {
      const path = new URL(url).pathname;
      if (path === "/" || path === "") {
        return "youtube_home";
      }
    } catch {}
    return "youtube_page";
  }

  if (urlLower.includes("google.com")) {
    if (urlLower.includes("/search")) {
      return "google_search_results";
    }
    return "google_home";
  }

  if (urlLower.includes("linkedin.com")) {
    if (urlLower.includes("/feed")) {
      return "linkedin_home";
    }
    if (urlLower.includes("/in/")) {
      return "linkedin_profile";
    }
    if (urlLower.includes("/jobs")) {
      return "linkedin_jobs";
    }
    if (urlLower.includes("/search")) {
      return "linkedin_search";
    }
    return "linkedin_home";
  }

  if (urlLower.includes("instagram.com")) {
    if (urlLower.includes("/p/") || urlLower.includes("/reel/")) {
      return "instagram_post";
    }
    try {
      const path = new URL(url).pathname;
      if (path === "/" || path === "" || path.includes("/feed")) {
        return "instagram_home";
      }
      if (path.length > 2) {
        return "instagram_profile";
      }
    } catch {}
    return "instagram_home";
  }

  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) {
    if (urlLower.includes("/status/")) {
      return "twitter_status";
    }
    if (urlLower.includes("/home")) {
      return "twitter_home";
    }
    return "twitter_profile";
  }

  if (urlLower.includes("amazon.com")) {
    if (urlLower.includes("/cart") || urlLower.includes("/gp/cart")) {
      return "amazon_cart";
    }
    if (urlLower.includes("/s?") || urlLower.includes("/s/")) {
      return "amazon_search";
    }
    if (urlLower.includes("/dp/") || urlLower.includes("/gp/product")) {
      return "amazon_product";
    }
    return "amazon_home";
  }

  if (urlLower.includes("wikipedia.org")) {
    if (urlLower.includes("/wiki/")) {
      return "wikipedia_article";
    }
    return "wikipedia_home";
  }

  if (urlLower.includes("reddit.com")) {
    if (urlLower.includes("/r/")) {
      return "reddit_subreddit";
    }
    if (urlLower.includes("/comments/")) {
      return "reddit_comments";
    }
    return "reddit_home";
  }

  if (urlLower.includes("yahoo.com")) {
    if (urlLower.includes("search.yahoo.com")) {
      return "yahoo_search_results";
    }
    return "yahoo_home";
  }

  return "generic";
}
