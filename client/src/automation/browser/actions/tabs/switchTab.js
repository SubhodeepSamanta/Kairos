import { switchTab } from "../../browser.js";

export async function switchBrowserTab(index) {
  await switchTab(index);
  return {
    success: true,
    index,
    operation: "switch_tab"
  };
}
