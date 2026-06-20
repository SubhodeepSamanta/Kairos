import { closeTab } from "../../browser.js";

export async function closeBrowserTab(index) {
  await closeTab(index);
  return {
    success: true,
    index,
    operation: "close_tab"
  };
}
