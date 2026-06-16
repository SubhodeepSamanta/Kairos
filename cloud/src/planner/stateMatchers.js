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

export function matchTabSwitch() {
  return null;
}

export function matchReadPage() {
  return null;
}

export function matchEvents(
  task,
  observation
) {
  return null;
}