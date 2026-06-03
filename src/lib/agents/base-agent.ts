import { XMLParser } from 'fast-xml-parser'

export interface HistoricalArticle {
  title: string
  url: string
  publishedDate: string
  description?: string
  author?: string
}

export interface AgentResult {
  success: boolean
  articles: HistoricalArticle[]
  articlesFound: number
  strategy: string
  confidence: number // 0-1, how confident this agent is about handling this URL
  errors?: string[]
  metadata?: {
    platformDetected?: string
    methodsUsed?: string[]
    totalTime?: number
  }
}

export interface PlatformIndicators {
  urlPatterns: string[]
  htmlIndicators: string[]
  apiEndpoints: string[]
  confidence: number
}

export abstract class BaseAgent {
  abstract name: string
  abstract description: string
  
  /**
   * Quickly analyze if this agent can handle the URL
   * Should be fast (URL-based checks only)
   */
  abstract canHandle(url: string): Promise<number> // Returns confidence 0-1
  
  /**
   * Perform deep verification if this platform is actually what we think it is
   * Can make network requests, check content, etc.
   */
  abstract verify(url: string): Promise<boolean>
  
  /**
   * Collect articles from the platform
   */
  abstract collect(url: string): Promise<AgentResult>
  
  /**
   * Get platform-specific indicators for detection
   */
  abstract getPlatformIndicators(): PlatformIndicators
  
  /**
   * Helper to build absolute URLs for server-side fetch
   */
  protected getAbsoluteUrl(relativePath: string): string {
    // Agents may run server-side (Inngest worker) where they call back into the
    // app's own proxy routes. Prefer an explicit APP_URL so the self-call target
    // is configurable across environments; fall back to Vercel/localhost.
    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    return `${baseUrl}${relativePath}`
  }
  
  /**
   * Helper to parse dates consistently
   */
  protected parseDate(dateStr: string): string {
    try {
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString()
      }
      
      // Handle "Jan 2023" format
      const monthYearMatch = dateStr.match(/([A-Za-z]+)\s+(\d{4})/)
      if (monthYearMatch) {
        const [, month, year] = monthYearMatch
        const date = new Date(`${month} 1, ${year}`)
        return date.toISOString()
      }
      
      return new Date().toISOString()
    } catch {
      return new Date().toISOString()
    }
  }
  
  /**
   * Helper to deduplicate articles by URL
   */
  protected deduplicateAndSort(articles: HistoricalArticle[]): HistoricalArticle[] {
    const seen = new Set<string>()
    const unique = articles.filter(article => {
      if (seen.has(article.url)) return false
      seen.add(article.url)
      return true
    })
    
    return unique.sort((a, b) => 
      new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
    )
  }
  
  /**
   * Helper to check if a URL looks like an article
   */
  protected looksLikeArticle(url: string): boolean {
    let path: string
    try {
      path = new URL(url).pathname
    } catch {
      path = url
    }
    const lower = path.toLowerCase()

    // Exclude obvious non-article sections (nav, taxonomy, account, legal…).
    const excluded = [
      '/tag/', '/tags/', '/author/', '/authors/', '/category/', '/categories/',
      '/about', '/contact', '/privacy', '/terms', '/search', '/page/', '/pages/',
      '/feed', '/rss', '/team', '/careers', '/jobs', '/pricing', '/login',
      '/signup', '/sign-up', '/subscribe', '/account', '/resources', '/faq',
    ]
    if (excluded.some(e => lower.includes(e))) return false

    const segments = path.split('/').filter(Boolean)
    if (segments.length === 0) return false // root is not an article

    // Strong positive signals.
    const positive: (string | RegExp)[] = [
      '/post/', '/posts/', '/blog/', '/article/', '/articles/', '/essays/',
      '/writing/', '/p/',
      /\/\d{4}\/\d{2}\//, // /YYYY/MM/
      /\/\d{4}\//,        // /YYYY/
    ]
    if (positive.some(p => (typeof p === 'string' ? lower.includes(p) : p.test(lower)))) {
      return true
    }

    // Otherwise, a multi-word hyphenated final slug is the typical article shape
    // (e.g. "grasping-your-growth"), while single-word slugs (/team/, /john/)
    // are usually sections — so require at least two words.
    const last = segments[segments.length - 1].replace(/\.\w+$/, '')
    return last.split('-').filter(Boolean).length >= 2
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared collection toolkit
  // One implementation of the RSS/Atom parsing, feed pagination and sitemap
  // recursion that agents previously each re-implemented. Behavior-preserving
  // (consolidated from the most complete agent) plus a sitemap depth/child cap.
  // ─────────────────────────────────────────────────────────────────────────

  /** Normalize a URL to its origin (scheme + host, no path/trailing slash). */
  protected normalizeBase(url: string): string {
    try {
      return new URL(url).origin
    } catch {
      return url.replace(/\/+$/, '')
    }
  }

  /** Fetch text through the app's proxy routes (handles CORS + server self-hop). */
  protected async fetchTextViaProxy(targetUrl: string, mode: 'rss' | 'scrape' = 'scrape'): Promise<string> {
    const route = mode === 'rss' ? '/api/rss-proxy' : '/api/scrape-content'
    const res = await fetch(this.getAbsoluteUrl(`${route}?url=${encodeURIComponent(targetUrl)}`))
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${targetUrl}`)
    return res.text()
  }

  /** Parse an RSS or Atom feed XML string into articles. */
  protected parseFeedXml(xml: string, sourceUrl: string): HistoricalArticle[] {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
    })
    const doc = parser.parse(xml)
    const articles: HistoricalArticle[] = []

    let items: any[] = []
    let isAtom = false
    if (doc?.feed?.entry) {
      isAtom = true
      items = Array.isArray(doc.feed.entry) ? doc.feed.entry : [doc.feed.entry]
    } else if (doc?.rss?.channel?.item) {
      items = Array.isArray(doc.rss.channel.item) ? doc.rss.channel.item : [doc.rss.channel.item]
    }

    let host = ''
    try { host = new URL(sourceUrl).hostname } catch { /* ignore */ }

    for (const item of items) {
      try {
        let title: any, link: any, pubDate: any, description: any
        if (isAtom) {
          title = item.title?.['#text'] || item.title
          link = item.link?.['@_href']
            || (Array.isArray(item.link)
              ? (item.link.find((l: any) => l?.['@_rel'] !== 'self')?.['@_href'] || item.link[0]?.['@_href'])
              : item.link)
          pubDate = item.published || item.updated
          description = item.summary?.['#text'] || item.summary || item.content?.['#text'] || item.content
        } else {
          title = item.title?.['#text'] || item.title
          link = item.link?.['#text'] || item.link
          pubDate = item.pubDate || item['dc:date']
          description = item.description?.['#text'] || item.description
            || item['content:encoded']?.['#text'] || item['content:encoded']
        }

        if (title && link) {
          articles.push({
            title: String(title).trim(),
            url: String(link).trim(),
            publishedDate: pubDate ? this.parseDate(String(pubDate)) : new Date().toISOString(),
            description: description ? String(description).trim() : '',
            author: host,
          })
        }
      } catch { /* skip malformed item */ }
    }

    return articles
  }

  /** Fetch + parse a single feed URL. */
  protected async collectFromFeed(feedUrl: string): Promise<HistoricalArticle[]> {
    const xml = await this.fetchTextViaProxy(feedUrl, 'rss')
    return this.parseFeedXml(xml, feedUrl)
  }

  /** Fetch a feed and follow ?page=N / ?p=N pagination until exhausted. */
  protected async collectFromFeedPaginated(feedUrl: string, opts: { maxPages?: number; delayMs?: number } = {}): Promise<HistoricalArticle[]> {
    const maxPages = opts.maxPages ?? 25
    const delayMs = opts.delayMs ?? 800
    const all: HistoricalArticle[] = []

    const base = await this.collectFromFeed(feedUrl).catch(() => [] as HistoricalArticle[])
    all.push(...base)

    if (base.length > 0) {
      for (const param of ['page', 'p']) {
        let page = 2
        let emptyStreak = 0
        const before = all.length
        while (page <= maxPages && emptyStreak < 3) {
          const sep = feedUrl.includes('?') ? '&' : '?'
          try {
            const pageArticles = await this.collectFromFeed(`${feedUrl}${sep}${param}=${page}`)
            if (pageArticles.length === 0) emptyStreak++
            else { emptyStreak = 0; all.push(...pageArticles) }
          } catch {
            emptyStreak++
          }
          page++
          await new Promise(r => setTimeout(r, delayMs))
        }
        if (all.length > before) break // found a working pagination param
      }
    }

    return this.deduplicateAndSort(all)
  }

  /** Recursively parse a sitemap (handles sitemap index) with depth/child caps. */
  protected async parseSitemapRecursive(
    sitemapUrl: string,
    opts: { maxDepth?: number; maxChildren?: number; depth?: number } = {},
  ): Promise<HistoricalArticle[]> {
    const maxDepth = opts.maxDepth ?? 3
    const maxChildren = opts.maxChildren ?? 50
    const depth = opts.depth ?? 0
    const articles: HistoricalArticle[] = []
    if (depth > maxDepth) return articles

    let host = ''
    try { host = new URL(sitemapUrl).hostname } catch { /* ignore */ }

    const xml = await this.fetchTextViaProxy(sitemapUrl, 'scrape')
    const parser = new XMLParser({ ignoreAttributes: false })
    const doc = parser.parse(xml)

    if (doc?.sitemapindex?.sitemap) {
      let children = doc.sitemapindex.sitemap
      if (!Array.isArray(children)) children = [children]
      for (const child of children.slice(0, maxChildren)) {
        if (child?.loc) {
          try {
            const sub = await this.parseSitemapRecursive(String(child.loc), { maxDepth, maxChildren, depth: depth + 1 })
            articles.push(...sub)
          } catch { /* skip bad child sitemap */ }
        }
      }
    }

    if (doc?.urlset?.url) {
      let urls = doc.urlset.url
      if (!Array.isArray(urls)) urls = [urls]
      for (const u of urls) {
        const loc = u?.loc
        if (loc && this.looksLikeArticle(String(loc))) {
          articles.push({
            title: this.titleFromUrl(String(loc)),
            url: String(loc),
            publishedDate: u.lastmod ? this.parseDate(String(u.lastmod)) : new Date().toISOString(),
            author: host,
          })
        }
      }
    }

    return articles
  }

  /** Generic pagination helper over a page-producing function. */
  protected async collectWithPagination(
    makeArticles: (page: number) => Promise<HistoricalArticle[]>,
    opts: { maxPages?: number; emptyStreakStop?: number; startPage?: number; delayMs?: number } = {},
  ): Promise<HistoricalArticle[]> {
    const maxPages = opts.maxPages ?? 25
    const emptyStreakStop = opts.emptyStreakStop ?? 3
    const delayMs = opts.delayMs ?? 600
    let page = opts.startPage ?? 1
    let emptyStreak = 0
    const all: HistoricalArticle[] = []
    while (page <= maxPages && emptyStreak < emptyStreakStop) {
      let pageArticles: HistoricalArticle[] = []
      try { pageArticles = await makeArticles(page) } catch { pageArticles = [] }
      if (pageArticles.length === 0) emptyStreak++
      else { emptyStreak = 0; all.push(...pageArticles) }
      page++
      if (page <= maxPages) await new Promise(r => setTimeout(r, delayMs))
    }
    return all
  }

  /** Derive a human-ish title from a URL slug. */
  protected titleFromUrl(url: string): string {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, '')
      const slug = path.split('/').filter(Boolean).pop() || ''
      const cleaned = slug.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ').trim()
      return cleaned ? cleaned.replace(/\b\w/g, c => c.toUpperCase()) : url
    } catch {
      return url
    }
  }

  /** Decode the most common HTML entities in extracted text. */
  protected decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&hellip;/g, '…')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
  }
}