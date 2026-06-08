import { search } from 'ddg-search'

export async function webSearch(query, maxResults = 5) {
  try {
    const results = await search(query, {
      maxResults: Math.min(maxResults, 10)
    })

    const items = results?.results

    if (!items?.length) {
      return { success: false, error: 'No results', data: [] }
    }

    return {
      success: true,
      data: items.slice(0, maxResults).map((r, i) => ({
        position: i + 1,
        title: r.title || '',
        url: r.url || r.link || '',
        description: r.description || r.snippet || ''
      }))
    }
  } catch (err) {
    return { success: false, error: err.message, data: [] }
  }
}
