import DuckDuckGoSearch from 'ddg-search'

export async function webSearch(query, maxResults = 5) {
  try {
    const ddg = new DuckDuckGoSearch()
    const results = await ddg.search(query, {
      maxResults: Math.min(maxResults, 10)
    })

    if (!results?.length) {
      return { success: false, error: 'No results', data: [] }
    }

    return {
      success: true,
      data: results.slice(0, maxResults).map((r, i) => ({
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
