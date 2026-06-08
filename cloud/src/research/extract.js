import * as cheerio
from "cheerio";

export async function extractContent(
  url
) {

  try {

    const response =
      await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }
      });

    const html =
      await response.text();

    const $ =
      cheerio.load(html);

    $("script").remove();
    $("style").remove();

    const text =
      $("body")
        .text()
        .replace(/\s+/g, " ")
        .trim();

    return text.slice(
      0,
      10000
    );

  }

  catch {

    return "";
  }
}