export function extractAffordances(browserState) {
  const clickable = [];
  const typeable = [];
  const selectable = [];
  const expandable = [];
  const navigable = [];
  const downloadable = [];

  const elements = [
    ...(browserState.inputs || []).map(e => ({ ...e, source: "inputs" })),
    ...(browserState.buttons || []).map(e => ({ ...e, source: "buttons" })),
    ...(browserState.links || []).map(e => ({ ...e, source: "links" }))
  ];

  for (const element of elements) {
    if (element.visible === false || element.disabled === true) {
      continue;
    }

    const textLower = `${element.text || ""} ${element.label || ""} ${element.name || ""} ${element.ariaLabel || ""} ${element.placeholder || ""}`.toLowerCase();
    
    // Check typeable
    if (element.source === "inputs" && !["submit", "button", "checkbox", "radio", "hidden"].includes(element.type)) {
      typeable.push(element);
    }
    
    // Check clickable
    if (element.source === "buttons" || element.source === "links" || (element.source === "inputs" && ["submit", "button", "checkbox", "radio"].includes(element.type))) {
      clickable.push(element);
    }

    // Check selectable
    if (element.source === "inputs" && ["checkbox", "radio"].includes(element.type)) {
      selectable.push(element);
    } else if (textLower.includes("select") || textLower.includes("option") || element.role === "combobox" || element.role === "listbox") {
      selectable.push(element);
    }

    // Check expandable
    if (textLower.includes("menu") || textLower.includes("expand") || textLower.includes("dropdown") || (element.role === "button" && textLower.includes("show"))) {
      expandable.push(element);
    }

    // Check navigable
    if (element.href || element.source === "links" || element.purpose === "tab") {
      navigable.push(element);
    }

    // Check downloadable
    if (textLower.includes("download") || textLower.includes("export") || (element.href && /\.(pdf|csv|xlsx|zip|txt|json)$/i.test(element.href))) {
      downloadable.push(element);
    }
  }

  return {
    clickable,
    typeable,
    selectable,
    expandable,
    navigable,
    downloadable
  };
}
