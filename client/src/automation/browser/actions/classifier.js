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

  let site = "generic";
  let pageType = "content_page";
  let legacyPageType = "generic";

  if (urlLower.includes("github.com")) {
    site = "github";
    if (urlLower.includes("/search")) {
      pageType = "result_page";
      legacyPageType = "github_search_results";
    } else {
      const hasSearchInput = (elements.inputs || []).some(input => input.purpose === "search_input");
      if (hasSearchInput) {
        pageType = "search_page";
        legacyPageType = "github_search_overlay";
      } else {
        try {
          const path = new URL(url).pathname;
          if (path === "/" || path === "") {
            pageType = "home_page";
            legacyPageType = "github_home";
          } else {
            pageType = "content_page";
            legacyPageType = "github_repo";
          }
        } catch {
          pageType = "content_page";
          legacyPageType = "github_repo";
        }
      }
    }
  } else if (urlLower.includes("youtube.com")) {
    site = "youtube";
    if (urlLower.includes("/shorts")) {
      pageType = "video_page";
      legacyPageType = "youtube_shorts";
    } else if (urlLower.includes("/results")) {
      pageType = "result_page";
      legacyPageType = "youtube_results";
    } else if (urlLower.includes("/watch")) {
      pageType = "video_page";
      legacyPageType = "youtube_video";
    } else {
      try {
        const path = new URL(url).pathname;
        if (path === "/" || path === "") {
          pageType = "home_page";
          legacyPageType = "youtube_home";
        } else {
          pageType = "content_page";
          legacyPageType = "youtube_page";
        }
      } catch {
        pageType = "content_page";
        legacyPageType = "youtube_page";
      }
    }
  } else if (urlLower.includes("google.com")) {
    site = "google";
    if (urlLower.includes("/search")) {
      pageType = "result_page";
      legacyPageType = "google_search_results";
    } else {
      pageType = "home_page";
      legacyPageType = "google_home";
    }
  } else if (urlLower.includes("linkedin.com")) {
    site = "linkedin";
    if (urlLower.includes("/feed")) {
      pageType = "home_page";
      legacyPageType = "linkedin_home";
    } else if (urlLower.includes("/in/")) {
      pageType = "profile_page";
      legacyPageType = "linkedin_profile";
    } else if (urlLower.includes("/jobs")) {
      pageType = "content_page";
      legacyPageType = "linkedin_jobs";
    } else if (urlLower.includes("/search")) {
      pageType = "result_page";
      legacyPageType = "linkedin_search";
    } else {
      pageType = "home_page";
      legacyPageType = "linkedin_home";
    }
  } else if (urlLower.includes("instagram.com")) {
    site = "instagram";
    if (urlLower.includes("/p/") || urlLower.includes("/reel/")) {
      pageType = "content_page";
      legacyPageType = "instagram_post";
    } else {
      try {
        const path = new URL(url).pathname;
        if (path === "/" || path === "" || path.includes("/feed")) {
          pageType = "home_page";
          legacyPageType = "instagram_home";
        } else if (path.length > 2) {
          pageType = "profile_page";
          legacyPageType = "instagram_profile";
        } else {
          pageType = "home_page";
          legacyPageType = "instagram_home";
        }
      } catch {
        pageType = "home_page";
        legacyPageType = "instagram_home";
      }
    }
  } else if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) {
    site = "twitter";
    if (urlLower.includes("/status/")) {
      pageType = "content_page";
      legacyPageType = "twitter_status";
    } else if (urlLower.includes("/home")) {
      pageType = "home_page";
      legacyPageType = "twitter_home";
    } else {
      pageType = "profile_page";
      legacyPageType = "twitter_profile";
    }
  } else if (urlLower.includes("amazon.com")) {
    site = "amazon";
    if (urlLower.includes("/cart") || urlLower.includes("/gp/cart")) {
      pageType = "form_page";
      legacyPageType = "amazon_cart";
    } else if (urlLower.includes("/s?") || urlLower.includes("/s/")) {
      pageType = "result_page";
      legacyPageType = "amazon_search";
    } else if (urlLower.includes("/dp/") || urlLower.includes("/gp/product")) {
      pageType = "product_page";
      legacyPageType = "amazon_product";
    } else {
      pageType = "home_page";
      legacyPageType = "amazon_home";
    }
  } else if (urlLower.includes("wikipedia.org")) {
    site = "wikipedia";
    if (urlLower.includes("/wiki/")) {
      pageType = "content_page";
      legacyPageType = "wikipedia_article";
    } else {
      pageType = "home_page";
      legacyPageType = "wikipedia_home";
    }
  } else if (urlLower.includes("reddit.com")) {
    site = "reddit";
    if (urlLower.includes("/r/")) {
      pageType = "result_page";
      legacyPageType = "reddit_subreddit";
    } else if (urlLower.includes("/comments/")) {
      pageType = "content_page";
      legacyPageType = "reddit_comments";
    } else {
      pageType = "home_page";
      legacyPageType = "reddit_home";
    }
  } else if (urlLower.includes("yahoo.com")) {
    site = "yahoo";
    if (urlLower.includes("search.yahoo.com")) {
      pageType = "result_page";
      legacyPageType = "yahoo_search_results";
    } else {
      pageType = "home_page";
      legacyPageType = "yahoo_home";
    }
  }

  return { site, pageType, legacyPageType };
}
