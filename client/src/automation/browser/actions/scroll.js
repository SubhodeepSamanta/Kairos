import { getPage } from "../browser.js";

export async function scrollPage(
  direction
) {

  const page =
    await getPage();

  const amount = 800;

  await page.evaluate(
    ({ direction, amount }) => {

      window.scrollBy(
        0,
        direction === "up"
          ? -amount
          : amount
      );

    },
    {
      direction,
      amount
    }
  );

  return {
    success: true,
    direction
  };
}