export const amazonSkill = {
  name: "AmazonSkill",
  canHandle(task, browserState) {
    const pageType = browserState.pageType || "";
    return pageType.startsWith("amazon_");
  },
  execute(task, browserState) {
    const objective = (task.objective || "").toLowerCase();
    const actions = [];

    // Search product
    if (objective.includes("search") || objective.includes("find") || objective.includes("query")) {
      let query = "";
      const quoteMatch = objective.match(/['"](.*?)['"]/);
      if (quoteMatch && quoteMatch[1].trim()) {
        query = quoteMatch[1].trim();
      } else {
        const queryMatch = objective.match(/search (?:amazon for|for) (['"]?)(.*?)\1/i) || objective.match(/find (['"]?)(.*?)\1/i) || objective.match(/search (['"]?)(.*?)\1/i);
        query = queryMatch ? queryMatch[2] : "";
      }

      if (query) {
        const searchInput = (browserState.inputs || []).find(input => input.purpose === "search_input");
        if (searchInput) {
          actions.push({
            type: "type",
            params: {
              element: searchInput.id,
              text: query
            }
          });
          actions.push({
            type: "press_key",
            params: {
              key: "Enter"
            }
          });
          return actions;
        }
      }
    }

    // Add to cart
    if (objective.includes("add to cart") || objective.includes("add to basket") || objective.includes("buy")) {
      if (browserState.pageType === "amazon_product") {
        const addToCartBtn = (browserState.buttons || []).find(btn => btn.purpose === "add_to_cart_button");
        if (addToCartBtn) {
          actions.push({
            type: "click",
            params: {
              element: addToCartBtn.id
            }
          });
          return actions;
        }
      }
    }

    // Go to Checkout / Cart
    if (objective.includes("checkout") || objective.includes("cart") || objective.includes("basket")) {
      const checkoutBtn = (browserState.buttons || []).find(btn => btn.purpose === "checkout_button");
      if (checkoutBtn) {
        actions.push({
          type: "click",
          params: {
            element: checkoutBtn.id
          }
        });
        return actions;
      }
      
      const cartLink = (browserState.links || []).find(link => link.purpose === "cart_link");
      if (cartLink) {
        actions.push({
          type: "click",
          params: {
            element: cartLink.id
          }
        });
        return actions;
      }
    }

    return null;
  }
};
