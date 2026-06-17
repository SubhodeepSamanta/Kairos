export function evaluateSuccessCriteria(task, observation) {
  const criteriaList = task?.successCriteria;
  if (!criteriaList || !Array.isArray(criteriaList) || criteriaList.length === 0) {
    return null;
  }

  const browser = observation?.pageState || observation;
  const currentUrl = (observation?.url || browser?.url || "").toLowerCase();
  const currentTitle = (observation?.title || browser?.title || "").toLowerCase();
  const pageText = (browser?.text || "").toLowerCase();

  for (const criterion of criteriaList) {
    const critLower = criterion.toLowerCase();
    let handled = false;

    // 1. URL checks
    if (critLower.includes("url contains") || critLower.includes("url must contain")) {
      handled = true;
      const match = criterion.match(/contains\s+['"]?([^\s'"]+)['"]?/i);
      if (match) {
        const expected = match[1].toLowerCase();
        if (!currentUrl.includes(expected)) return false;
      } else {
        // Fallback simple search
        const words = criterion.split(/\s+/);
        const lastWord = words[words.length - 1].replace(/['"]/g, "");
        if (!currentUrl.includes(lastWord.toLowerCase())) return false;
      }
    }
    // 2. Title checks
    else if (critLower.includes("title contains") || critLower.includes("title must contain")) {
      handled = true;
      const match = criterion.match(/contains\s+['"]?([^'"]+)['"]?/i);
      if (match) {
        const expected = match[1].toLowerCase();
        if (!currentTitle.includes(expected)) return false;
      } else {
        const words = criterion.split(/\s+/);
        const lastWord = words[words.length - 1].replace(/['"]/g, "");
        if (!currentTitle.includes(lastWord.toLowerCase())) return false;
      }
    }
    // 3. Input value checks (e.g. "Search input contains lofi")
    else if (critLower.includes("input contains") || critLower.includes("input value")) {
      handled = true;
      const match = criterion.match(/contains\s+['"]?([^'"]+)['"]?/i);
      if (match) {
        const expected = match[1].toLowerCase();
        const inputs = browser?.inputs || [];
        const anyInputMatches = inputs.some(input => {
          const val = (input.value || "").toLowerCase();
          return val.includes(expected);
        });
        if (!anyInputMatches) return false;
      }
    }
    // 4. General text checks
    else if (critLower.includes("text contains") || critLower.includes("page contains")) {
      handled = true;
      const match = criterion.match(/contains\s+['"]?([^'"]+)['"]?/i);
      if (match) {
        const expected = match[1].toLowerCase();
        if (!pageText.includes(expected)) return false;
      }
    }

    // If we can't verify this criterion programmatically, must delegate to LLM verifier
    if (!handled) {
      return null;
    }
  }

  return true;
}


export function matchNavigation(task, observation) {
  const action = observation?.action;
  
  // Only match actual navigate actions, not objective keywords
  if (action?.type !== "navigate" || !action?.params?.url) {
    return null;
  }

  const currentUrl = observation?.url || observation?.pageState?.url;
  if (!currentUrl) {
    return null;
  }

  try {
    const targetHost = new URL(action.params.url).hostname.replace("www.", "");
    const currentHost = new URL(currentUrl).hostname.replace("www.", "");
    
    if (currentHost === targetHost || currentUrl.includes(targetHost)) {
      return {
        achieved: true,
        reason: `Programmatic verification: Successfully navigated to host ${targetHost}.`
      };
    }
  } catch (e) {
    if (currentUrl.includes(action.params.url)) {
      return {
        achieved: true,
        reason: `Programmatic verification: URL matches target.`
      };
    }
  }
  return null;
}

export function matchFormFill(task, observation) {
  const action = observation?.action;
  const pageState = observation?.pageState || observation;
  
  const obj = task?.objective?.toLowerCase() || "";
  if (obj.includes("search") || obj.includes("find") || obj.includes("query")) {
    return null;
  }
  
  if (action?.type === "type" && action?.params?.text) {
    const targetElementId = action.params.element;
    const typedText = action.params.text.toLowerCase().trim();
    
    // Find the input element in the page state and check its value
    const inputs = pageState?.inputs || [];
    const targetInput = inputs.find(input => input.id === targetElementId);
    
    if (targetInput && targetInput.value) {
      const actualValue = targetInput.value.toLowerCase().trim();
      if (actualValue.includes(typedText) || typedText.includes(actualValue)) {
        return {
          achieved: true,
          reason: `Programmatic verification: Text successfully entered into input element [${targetElementId}].`
        };
      }
    }
  }
  return null;
}

export function matchTabSwitch(task, observation) {
  const action = observation?.action;
  if (action?.type === "switch_tab" || action?.type === "new_tab" || action?.type === "close_tab") {
    if (observation.success) {
      return {
        achieved: true,
        reason: `Programmatic verification: Tab operation '${action.type}' succeeded.`
      };
    }
  }
  return null;
}

export function matchReadPage(task, observation) {
  const action = observation?.action;
  
  // If the objective requires real action/interaction, a pure read cannot satisfy it.
  const obj = (task?.objective || "").toLowerCase();
  const requiresAction = obj.includes("enter") || obj.includes("type") || obj.includes("click") || 
                         obj.includes("search") || obj.includes("submit") || obj.includes("press") ||
                         obj.includes("play") || obj.includes("like") || obj.includes("skip") || obj.includes("pause");
  if (requiresAction) {
    return null;
  }

  if (action?.type === "read_ui" || action?.type === "extract_metadata" || action?.type === "extract_links" || action?.type === "extract_data") {
    if (observation.success) {
      return {
        achieved: true,
        reason: `Programmatic verification: Read/Extract operation '${action.type}' succeeded.`
      };
    }
  }
  return null;
}

export function matchEvents(
  task,
  observation
) {
  return null;
}

export function matchSearch(task, observation) {
  const browser = observation?.pageState || observation;
  const obj = (task?.objective || "").toLowerCase();
  
  if (!(obj.includes("search") || obj.includes("query") || obj.includes("find"))) {
    return null;
  }

  const currentUrl = (observation?.url || browser?.url || "").toLowerCase();
  const pageType = (browser?.pageType || "").toLowerCase();
  const genericPageType = (browser?.genericPageType || "").toLowerCase();

  // If pageType indicates results, or URL has search queries
  if (pageType.includes("results") || pageType.includes("search") || 
      genericPageType.includes("result") || genericPageType.includes("search") ||
      currentUrl.includes("/search") || currentUrl.includes("?q=") || 
      currentUrl.includes("&q=") || currentUrl.includes("search?") || 
      currentUrl.includes("search_query=")) {
    return {
      achieved: true,
      reason: `Programmatic verification: Search results page detected (pageType: ${pageType}, genericPageType: ${genericPageType}, URL: ${currentUrl}).`
    };
  }

  return null;
}