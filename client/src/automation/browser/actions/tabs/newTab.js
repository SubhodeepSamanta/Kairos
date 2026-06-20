import { createNewTab } from "../../browser.js";

export async function newTab() {
  const result = await createNewTab();
  return {
    ...result,
    operation: "new_tab"
  };
}
