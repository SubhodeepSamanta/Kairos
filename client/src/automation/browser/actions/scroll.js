import { getPage } from "../browser.js";

export async function scrollPage(
  direction
) {

  const page =
    await getPage();

const beforeY =
  await page.evaluate(
    () => window.scrollY
  );

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

const afterY =
  await page.evaluate(
    () => window.scrollY
  );

return {
  success:
    beforeY !== afterY,

  direction,

  beforeY,
  afterY
};
}