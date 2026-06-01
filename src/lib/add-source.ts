import { RSSParser } from '@/lib/rss-parser'
import { DatabaseService, type Source } from '@/lib/database'
import { CollectionOrchestrator } from '@/lib/agents'

function estimateReadTime(content: string): string {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wordsPerMinute)
  return `${minutes} min read`
}

export interface AddSourceResult {
  source: Source
  totalArticles: number
  info: string
}

/**
 * Fast step: create the source row only. Does a best-effort RSS lookup for a
 * nicer title/description but never runs the (slow) article collection, so it
 * returns quickly and the UI can move on.
 */
export async function createSource(rawUrl: string): Promise<Source> {
  const db = new DatabaseService()
  const url = rawUrl.trim()

  let feedTitle = 'New Blog Source'
  let feedDescription = 'Recently added blog source'

  try {
    const parsedFeed = await RSSParser.fetchAndParse(url)
    feedTitle = parsedFeed.title || feedTitle
    feedDescription = parsedFeed.description || feedDescription
  } catch {
    try {
      const u = new URL(url)
      const host = u.hostname.replace('www.', '').replace('.com', '').replace('.org', '').replace('.net', '')
      feedTitle = host.charAt(0).toUpperCase() + host.slice(1) + ' Blog'
    } catch {
      // keep default title
    }
  }

  return db.addSource({
    name: feedTitle,
    url,
    description: feedDescription,
    status: 'active',
    last_fetched_at: new Date().toISOString(),
    articles_count: 0,
  })
}

/**
 * Heavy step: agent-based collection + persistence for an already-created
 * source. Safe to run in the background. Updates the source's article count
 * when finished. Falls back to plain RSS if the agents find nothing.
 */
export async function collectArticlesForSource(source: Source, rawUrl: string): Promise<{ totalArticles: number; info: string }> {
  const db = new DatabaseService()
  const url = rawUrl.trim()

  let totalArticles = 0
  let info = ''

  const orchestrator = new CollectionOrchestrator()
  const collectionResult = await orchestrator.collectHistoricalArticles(url)

  if (collectionResult.success && collectionResult.articles.length > 0) {
    const agentArticles = collectionResult.articles.map((article: any) => ({
      source_id: source.id,
      title: article.title,
      description: article.description || 'Article collected via intelligent agent system',
      content: article.content || article.description,
      url: article.url,
      author: article.author || source.name,
      published_at: article.publishedDate,
      image_url: article.imageUrl,
      categories: [],
      read_time: estimateReadTime(article.content || article.description || ''),
      is_read: false,
      is_bookmarked: false,
      is_enhanced: !!article.content,
      content_length: (article.content || '').length,
      ai_analysis: {},
      key_quotes: [],
      main_themes: [],
      contradicts_previous: false,
      related_article_ids: [],
    }))

    const storedArticles = await db.addArticles(agentArticles)
    totalArticles = storedArticles.length
    await db.updateSource(source.id, { articles_count: totalArticles })
    info = ` using ${collectionResult.agentUsed} agent`
  } else {
    try {
      const parsedFeed = await RSSParser.fetchAndParse(url)
      const rssArticles = parsedFeed.items.map((item) => ({
        source_id: source.id,
        title: item.title,
        description: item.description,
        content: item.description,
        url: item.link,
        author: item.author,
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        image_url: item.enclosure?.url || undefined,
        categories: item.categories || [],
        read_time: estimateReadTime(item.description || ''),
        is_read: false,
        is_bookmarked: false,
        is_enhanced: false,
        content_length: (item.description || '').length,
        ai_analysis: {},
        key_quotes: [],
        main_themes: [],
        contradicts_previous: false,
        related_article_ids: [],
      }))

      const storedArticles = await db.addArticles(rssArticles)
      totalArticles = storedArticles.length
      await db.updateSource(source.id, { articles_count: totalArticles })
      info = ' (RSS fallback - limited content)'
    } catch {
      info = ' (collection failed - source added for future sync)'
    }
  }

  return { totalArticles, info }
}

/**
 * Single source of truth for adding a blog source AND collecting + persisting
 * its articles in one awaited call. Used by callers that want the synchronous
 * behaviour (e.g. the Connect page).
 */
export async function addSourceWithCollection(rawUrl: string): Promise<AddSourceResult> {
  const source = await createSource(rawUrl)
  const { totalArticles, info } = await collectArticlesForSource(source, rawUrl)
  return { source: { ...source, articles_count: totalArticles }, totalArticles, info }
}
