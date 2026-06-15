import { getBrowserContext } from "../context.js";

export async function getContext() {

  const context =
    getBrowserContext();

  return {
    success: true,

    expected:
      "browser_context",

    pageState:
      context,

    ...context
  };
}