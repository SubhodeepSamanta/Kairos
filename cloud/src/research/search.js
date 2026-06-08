export async function searchWeb(
    query
) {

    const url =
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response =
        await fetch(url);

    const html =
        await response.text();

    const results = [];

    const regex =
        /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;

    let match;

    while (
        (match = regex.exec(html))
        !== null
    ) {

        results.push({
            url: match[1],
            title: match[2]
                .replace(/<[^>]+>/g, "")
                .trim()
        });

        if (
            results.length >= 10
        ) {
            break;
        }
    }

    return results;
}