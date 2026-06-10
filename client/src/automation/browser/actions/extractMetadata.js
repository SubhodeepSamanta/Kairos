import { getPage } from "../browser.js";

export async function extractMetadata() {

  const page =
    await getPage();

  const metadata =
    await page.evaluate(() => {

      const getMeta =
        name =>
          document
            .querySelector(
              `meta[name="${name}"]`
            )
            ?.content ||

          document
            .querySelector(
              `meta[property="${name}"]`
            )
            ?.content ||

          "";

      return {
        title:
          document.title,

        description:
          getMeta(
            "description"
          ),

        keywords:
          getMeta(
            "keywords"
          ),

        author:
          getMeta(
            "author"
          )
      };
    });

  return {
    success: true,
    metadata
  };
}