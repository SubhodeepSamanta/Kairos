import { listTabs } from "../browser.js";

export async function getTabs() {

  const tabs =
    await listTabs();

  return {
    success: true,
    tabs
  };
}