export function parseGoal(goalText) {
  if (!goalText) {
    return {
      objective: "navigate",
      platform: null,
      constraints: []
    };
  }

  const text = goalText.toLowerCase().trim();
  let objective = "navigate";
  const constraints = [];

  // Determine objective
  if (/play|video|music|listen|watch/i.test(text)) {
    objective = "consume media";
  } else if (/login|signin|sign in|auth|signup|register/i.test(text)) {
    objective = "authenticate";
  } else if (/internship|jobs|career|find opportunities|discover/i.test(text)) {
    objective = "discover opportunities";
  } else if (/download|export|retrieve/i.test(text)) {
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

  // Extract target from context
  let target = null;

  const forMatch = goalText.match(/(?:for|of|to|about)\s+([A-Za-z0-9\s_\-]+)(?:\s+and|\s+on|\s+in|$)/i);
  if (forMatch && forMatch[1]) {
    const term = forMatch[1].trim().toLowerCase();
    if (term && !['for', 'of', 'to', 'about', 'on', 'in', 'and', 'the', 'a', 'an'].includes(term)) {
      constraints.push(term);
    }
  }

  if (!target && constraints.length > 0) {
    target = constraints[0];
  }

  if (!target && objective === "search_content") {
    const words = text.split(/\s+/).filter(w => w.length > 2 && 
      !['search', 'find', 'query', 'on', 'in', 'for', 'to', 'of', 'a', 'an', 'the'].includes(w));
    if (words.length > 0) {
      target = words[0];
    }
  }

  return {
    objective,
    platform: null,
    constraints: constraints.length > 1 ? constraints : (target ? [target] : [])
  };
}
