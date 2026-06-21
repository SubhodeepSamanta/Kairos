export function parseGoal(goalText) {
  const text = (goalText || "").toLowerCase().trim();
  let objective = "navigate";
  const constraints = [];

  // Determine objective
  if (/play|video|music|listen|watch/i.test(text)) {
    objective = "consume media";
  } else if (/login|signin|sign in|auth|signup|register/i.test(text)) {
    objective = "authenticate";
  } else if (/internship|jobs|career|find opportunities|discover/i.test(text)) {
    objective = "discover opportunities";
  } else if (/download|export|retrieve artifact/i.test(text)) {
    objective = "retrieve artifact";
  } else if (/extract|get|find|price|stars|info|deadline|summary/i.test(text)) {
    objective = "extract_information";
  } else if (/search|find|query/i.test(text)) {
    objective = "search_content";
  } else if (/compare|research|analyze/i.test(text)) {
    objective = "research";
  } else if (/open|go to|visit/i.test(text)) {
    objective = "navigate";
  }

  if (/newest|latest|recent/i.test(text)) {
    constraints.push("latest");
  }

  // Dynamic platform extraction using prepositions/verbs
  let platform = null;
  const platformRegexes = [
    /\bon\s+([a-z0-9\-]+)(?:\.com|\.org|\.net)?\b/gi,
    /\b(?:go\s+to|navigate\s+to|login\s+to|sign\s+in\s+to|log\s+in\s+to|visit|open|search)\s+([a-z0-9\-]+)(?:\.com|\.org|\.net)?\b/gi
  ];
  for (const regex of platformRegexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const plat = match[1];
      if (plat && !["for", "the", "a", "an", "newest", "latest", "recent", "video", "music", "song", "movie", "page", "site", "website", "portal"].includes(plat)) {
        platform = plat;
        constraints.push(plat);
      }
    }
  }

  // Extract queries after "for", "of", "to", "about"
  const forMatch = goalText.match(/(?:for|of|to|about)\s+([A-Za-z0-9\s_\-]+)(?:\s+and|\s+on|\s+in|$)/i);
  if (forMatch && forMatch[1]) {
    const term = forMatch[1].trim();
    // Clean up platform name from the term
    let cleaned = term;
    if (platform) {
      cleaned = cleaned.replace(new RegExp(`\\b${platform}\\b`, "gi"), "");
    }
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    if (cleaned && cleaned.length > 1 && !constraints.includes(cleaned)) {
      constraints.push(cleaned);
    }
  }

  // Fallback constraint if nothing else added
  if (constraints.length === 0) {
    const words = text.split(/\s+/).filter(w => w.length > 3 && !["play", "search", "login", "find", "extract", "get", "with", "that"].includes(w));
    if (words.length > 0) {
      constraints.push(words[0]);
    }
  }

  return {
    objective,
    platform,
    constraints: [...new Set(constraints)]
  };
}

