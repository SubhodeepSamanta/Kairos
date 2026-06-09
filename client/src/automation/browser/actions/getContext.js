import { getBrowserContext } from "../context.js";

export async function getContext() {

  return {
    success: true,
    ...getBrowserContext()
  };
}