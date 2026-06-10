import {
  switchTab
} from "../browser.js";

export async function switchBrowserTab(
  index
) {

  switchTab(index);

  return {
    success: true,
    index
  };
}