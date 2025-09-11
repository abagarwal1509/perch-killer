import { XMLParser } from 'fast-xml-parser'
import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class UniversalAgent extends BaseAgent {
  name = 'Universal Agent'
  description = 'Fallback agent for any website using generic RSS and sitemap strategies'

  async canHandle(url: string): Promise<number> {
    // Universal agent can always handle any URL as a fallback
    return 0.3 // Low confidence since it's generic
  }

  async verify(url: string): Promise<boolean> {
    // Universal agent doesn't need verification - it tries everything
    return true
  }

  async collect(url: string): Promise<AgentResult> {
    const startTime = Date.now()
    const articles: HistoricalArticle[] = []
    const errors: string[] = []
    const methodsUsed: string[] = []
    
    try {
      console.log(`🌍 Universal Agent: Starting collection for ${url}`)
      const domain = new URL(url).hostname
      
      // Method 1: Try RSS feeds with pagination
      console.log('📡 Universal Agent: Trying RSS feeds...')
      const rssUrls = [
        `${url}/rss`,
        `${url}/feed`,
        `${url}/feed.xml`,
        `${url}/atom.xml`,
        `${url}/rss.xml`,
        `${url}/feeds/posts/default`,
        `${url}/blog/rss`,
        `${url}/blog/feed`,
        // Magazine-specific RSS feeds (for sites like Aeon.co)
        `${url}/essays/feed`,
        `${url}/articles/feed`,
        `${url}/content/feed`,
        `${url}/posts/feed`,
        `${url}/feeds/all.xml`,
        `${url}/feeds/content.xml`,
        `${url}/feeds/essays.xml`,
        `${url}/feeds/articles.xml`,
        // Category-specific feeds
        `${url}/philosophy/feed`,
        `${url}/science/feed`,
        `${url}/psychology/feed`,
        `${url}/society/feed`,
        `${url}/culture/feed`,
        // Special case: Paul Graham's external RSS feed
        ...(domain === 'paulgraham.com' ? ['http://www.aaronsw.com/2002/feeds/pgessays.rss'] : []),
        // Podcast-specific RSS patterns
        `${url}/podcast`,
        `${url}/podcast/feed`,
        `${url}/episodes/feed`,
        `${url}/feed/podcast`,
        `${url}/podcast.xml`,
        `${url}/itunes.xml`
      ]
      
      for (const rssUrl of rssUrls) {
        try {
          // Use more aggressive pagination for podcast sites like nav.al
          const maxPages = (domain === 'nav.al' || rssUrl.includes('podcast')) ? 50 : 25
          const rssArticles = await this.collectFromRSSFeedWithPagination(rssUrl, maxPages)
          if (rssArticles.length > 0) {
            articles.push(...rssArticles)
            methodsUsed.push(`RSS: ${rssUrl}`)
            console.log(`✅ Universal Agent RSS: Found ${rssArticles.length} articles from ${rssUrl}`)
            break // Found working RSS feed
          }
        } catch (error) {
          errors.push(`RSS ${rssUrl}: ${error}`)
        }
      }
      
      // Method 2: Always try sitemaps as a primary source
      console.log('🗺️ Universal Agent: Trying sitemaps...')
      const sitemapUrls = [
        `${url}/sitemap.xml`,
        `${url}/sitemap_index.xml`,
        `${url}/post-sitemap.xml`,
        `${url}/page-sitemap.xml`,
        `${url}/sitemap_posts.xml`,
        `${url}/sitemap-posts.xml`,
        // Magazine-specific sitemap patterns
        `${url}/content-sitemap.xml`,
        `${url}/articles-sitemap.xml`,
        `${url}/essays-sitemap.xml`,
        `${url}/feeds/sitemap.xml`,
        `${url}/sitemaps/content.xml`,
        `${url}/sitemaps/posts.xml`
      ]
      
      for (const sitemapUrl of sitemapUrls) {
        try {
          const sitemapArticles = await this.parseSitemap(sitemapUrl)
          if (sitemapArticles.length > 0) {
            articles.push(...sitemapArticles)
            methodsUsed.push(`Sitemap: ${sitemapUrl}`)
            console.log(`✅ Universal Agent Sitemap: Found ${sitemapArticles.length} articles from ${sitemapUrl}`)
          }
        } catch (error) {
          errors.push(`Sitemap ${sitemapUrl}: ${error}`)
        }
      }
      
      // Method 3: Try web scraping content listing pages (fallback for magazines like Aeon)
      if (articles.length < 30) { // Only try this if we haven't found many articles
        console.log('📰 Universal Agent: Trying content listing pages...')
        const contentUrls = [
          `${url}/essays`,
          `${url}/articles`,
          `${url}/content`,
          `${url}/posts`,
          `${url}/blog`,
          `${url}/archive`,
          `${url}/all`,
          `${url}/latest`,
          // Podcast-specific pages
          `${url}/episodes`,
          `${url}/podcast`,
          `${url}/shows`,
          // Nav.al specific attempts (try root page with different approaches)
          ...(domain === 'nav.al' ? [
            url, // Try scraping the main page itself
            `${url}/?page=2`,
            `${url}/?page=3`,
            `${url}/?offset=20`,
            `${url}/feed?page=2`
          ] : [])
        ]
        
        for (const contentUrl of contentUrls) {
          try {
            const webArticles = await this.scrapeContentListingPage(contentUrl)
            if (webArticles.length > 0) {
              articles.push(...webArticles)
              methodsUsed.push(`Web scraping: ${contentUrl}`)
              console.log(`✅ Universal Agent Web: Found ${webArticles.length} articles from ${contentUrl}`)
              break // Found working content page
            }
          } catch (error) {
            errors.push(`Web scraping ${contentUrl}: ${error}`)
          }
        }
      }
      
      // Deduplicate and sort
      const uniqueArticles = this.deduplicateAndSort(articles)
      const totalTime = Date.now() - startTime
      
      console.log(`🎉 Universal Agent: Collected ${uniqueArticles.length} unique articles in ${totalTime}ms`)
      
      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: this.name,
        confidence: uniqueArticles.length > 50 ? 0.7 : 0.4, // Higher confidence if many articles found
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          platformDetected: 'Generic Website',
          methodsUsed,
          totalTime
        }
      }
      
    } catch (error) {
      return {
        success: false,
        articles: [],
        articlesFound: 0,
        strategy: this.name,
        confidence: 0.1,
        errors: [`Universal Agent failed: ${error}`]
      }
    }
  }

  getPlatformIndicators(): PlatformIndicators {
    return {
      urlPatterns: ['*'], // Universal patterns
      htmlIndicators: ['<rss', '<feed', 'sitemap'],
      apiEndpoints: ['/feed', '/rss', '/sitemap.xml'],
      confidence: 0.3
    }
  }

  private async collectFromRSSFeedWithPagination(rssUrl: string, maxPages: number = 25): Promise<HistoricalArticle[]> {
    const allArticles: HistoricalArticle[] = []
    
    // First, try the base RSS feed
    const baseArticles = await this.collectFromRSSFeed(rssUrl)
    allArticles.push(...baseArticles)
    
    // Try different pagination patterns if base feed has articles
    if (baseArticles.length > 0) {
      const paginationPatterns = ['page', 'paged', 'offset', 'p']
      
      for (const pattern of paginationPatterns) {
        let page = 2 // Start from page 2 since we already got page 1
        let consecutiveEmptyPages = 0
        const maxConsecutiveEmpty = 3
        
        while (page <= maxPages && consecutiveEmptyPages < maxConsecutiveEmpty) {
          try {
            const separator = rssUrl.includes('?') ? '&' : '?'
            let paginatedUrl: string
            
            if (pattern === 'offset') {
              // Offset-based pagination (assuming 10 items per page)
              const offset = (page - 1) * 10
              paginatedUrl = `${rssUrl}${separator}offset=${offset}`
            } else {
              // Page-based pagination
              paginatedUrl = `${rssUrl}${separator}${pattern}=${page}`
            }
            
            const pageArticles = await this.collectFromRSSFeed(paginatedUrl)
            
            if (pageArticles.length === 0) {
              consecutiveEmptyPages++
            } else {
              consecutiveEmptyPages = 0
              allArticles.push(...pageArticles)
            }
            
            page++
            await new Promise(resolve => setTimeout(resolve, 1000)) // Rate limiting
            
          } catch (pageError) {
            consecutiveEmptyPages++
            page++
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
        
        // If we found articles with this pattern, stop trying other patterns
        if (allArticles.length > baseArticles.length) {
          break
        }
      }
    }

    // Deduplicate articles by URL
    return this.deduplicateAndSort(allArticles)
  }

  private async collectFromRSSFeed(rssUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      const proxyUrl = this.getAbsoluteUrl(`/api/rss-proxy?url=${encodeURIComponent(rssUrl)}`)
      const response = await fetch(proxyUrl)
      
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`)
      }

      const rssXml = await response.text()
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true
      })
      
      const xmlDoc = parser.parse(rssXml)
      
      // Handle both RSS and Atom formats
      let items: any[] = []
      let isAtom = false
      
      if (xmlDoc.feed && xmlDoc.feed.entry) {
        isAtom = true
        items = Array.isArray(xmlDoc.feed.entry) ? xmlDoc.feed.entry : [xmlDoc.feed.entry]
      } else if (xmlDoc.rss && xmlDoc.rss.channel && xmlDoc.rss.channel.item) {
        items = Array.isArray(xmlDoc.rss.channel.item) ? xmlDoc.rss.channel.item : [xmlDoc.rss.channel.item]
      }
      
      for (const item of items) {
        try {
          let title, link, pubDate, description
          
          if (isAtom) {
            title = item.title?.['#text'] || item.title
            link = item.link?.['@_href'] || (Array.isArray(item.link) ? item.link[0]?.['@_href'] : item.link)
            pubDate = item.published || item.updated
            description = item.summary?.['#text'] || item.summary || item.content?.['#text'] || item.content
          } else {
            title = item.title?.['#text'] || item.title
            link = item.link?.['#text'] || item.link
            pubDate = item.pubDate || item['dc:date']
            description = item.description?.['#text'] || item.description || item['content:encoded']?.['#text'] || item['content:encoded']
          }
          
          if (title && link) {
            articles.push({
              title: typeof title === 'string' ? title.trim() : String(title).trim(),
              url: typeof link === 'string' ? link.trim() : String(link).trim(),
              publishedDate: pubDate ? this.parseDate(String(pubDate)) : new Date().toISOString(),
              description: description ? (typeof description === 'string' ? description.trim() : String(description).trim()) : '',
              author: new URL(rssUrl).hostname
            })
          }
        } catch (itemError) {
          // Skip invalid items
        }
      }
      
    } catch (error) {
      throw new Error(`RSS collection failed: ${error}`)
    }
    
    return articles
  }

  private async parseSitemap(sitemapUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(sitemapUrl)}`))
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const xml = await response.text()
      const parser = new XMLParser({ ignoreAttributes: false })
      const xmlDoc = parser.parse(xml)

      // Handle sitemap index (links to other sitemaps)
      if (xmlDoc.sitemapindex && xmlDoc.sitemapindex.sitemap) {
        let sitemaps = xmlDoc.sitemapindex.sitemap
        if (!Array.isArray(sitemaps)) sitemaps = [sitemaps]

        for (const sitemap of sitemaps) {
          if (sitemap.loc) {
            const subSitemapArticles = await this.parseSitemap(sitemap.loc)
            articles.push(...subSitemapArticles)
          }
        }
      }

      // Handle regular sitemap (URLs)
      if (xmlDoc.urlset && xmlDoc.urlset.url) {
        let urls = xmlDoc.urlset.url
        if (!Array.isArray(urls)) urls = [urls]

        for (const urlElement of urls) {
          const loc = urlElement.loc
          if (loc && this.looksLikeArticle(loc)) {
            const title = this.extractTitleFromUrl(loc)
            articles.push({
              title,
              url: loc,
              publishedDate: urlElement.lastmod || new Date().toISOString(),
              author: new URL(sitemapUrl).hostname
            })
          }
        }
      }
      
    } catch (error) {
      throw new Error(`Sitemap parsing failed: ${error}`)
    }
    
    return articles
  }

  private extractTitleFromUrl(url: string): string {
    const parts = url.split('/')
    const slug = parts[parts.length - 1] || parts[parts.length - 2]
    
    return slug
      .replace(/\.(html|php)$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  private async scrapeContentListingPage(contentUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(contentUrl)}`))
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const html = await response.text()
      const domain = new URL(contentUrl).hostname
      
      // Extract article links using common patterns for content listing pages
      const linkPatterns = [
        // Nav.al specific patterns (podcast episodes)
        /<h[1-6][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+(?:Files|David Deutsch|Vitalik|Beginning of Infinity|Caveman)[^<]*)<\/a>\s*<\/h[1-6]>/gi,
        /<a[^>]*href="([^"]*)"[^>]*>\s*<h[1-6][^>]*>([^<]+(?:Files|David Deutsch|Vitalik|Beginning of Infinity|Caveman)[^<]*)<\/h[1-6]>\s*<\/a>/gi,
        /<div[^>]*class="[^"]*post[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
        // Aeon.co style links
        /<a[^>]+href="([^"]*\/essays\/[^"]*)"[^>]*>/gi,
        /<a[^>]+href="([^"]*\/articles\/[^"]*)"[^>]*>/gi,
        /<a[^>]+href="([^"]*\/content\/[^"]*)"[^>]*>/gi,
        // Generic article links
        /<a[^>]+href="([^"]*(?:\/\d{4}\/|\/\d{2}\/|\/article\/|\/post\/|\/essay\/)[^"]*)"[^>]*>/gi,
        // Relative paths to articles
        /<a[^>]+href="(\/[^"]*(?:essay|article|post|content)[^"]*)"[^>]*>/gi,
        // Podcast/episode specific patterns
        /<a[^>]+href="([^"]*(?:episode|podcast|audio)[^"]*)"[^>]*>/gi,
        /<h[1-6][^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]{10,100})<\/a>\s*<\/h[1-6]>/gi
      ]
      
      for (const pattern of linkPatterns) {
        let match
        while ((match = pattern.exec(html)) !== null) {
          let url, title
          
          // Handle patterns that capture both URL and title
          if (match.length >= 3 && match[2]) {
            url = match[1]
            title = match[2].trim()
          } else {
            url = match[1]
            // Extract title from the link context if not captured by pattern
            const titleMatch = html.substring(Math.max(0, match.index - 200), match.index + 200)
              .match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>|<title[^>]*>([^<]+)<\/title>|>([^<]{10,100})</gi)
            
            title = titleMatch ? 
              (titleMatch[0].replace(/<[^>]*>/g, '').trim() || this.extractTitleFromUrl(url)) :
              this.extractTitleFromUrl(url)
          }
          
          const fullUrl = url.startsWith('http') ? url : `https://${domain}${url.startsWith('/') ? '' : '/'}${url}`
          
          // Better title validation for podcast content
          if (title && title.length > 3 && 
              !title.includes('...') && 
              !title.toLowerCase().includes('subscribe') &&
              !title.toLowerCase().includes('archive') &&
              !title.toLowerCase().includes('twitter') &&
              !title.toLowerCase().includes('instagram') &&
              title.length < 200) {
            
            console.log(`📝 Universal Agent: Found "${title}" at ${fullUrl}`)
            
            articles.push({
              title: title.replace(/&[^;]+;/g, '').trim(), // Remove HTML entities
              url: fullUrl,
              publishedDate: new Date().toISOString(),
              author: domain
            })
          }
        }
      }
      
      // Limit to reasonable number and deduplicate
      const uniqueArticles = articles.slice(0, 50)
      return this.deduplicateAndSort(uniqueArticles)
      
    } catch (error) {
      throw new Error(`Content page scraping failed: ${error}`)
    }
  }
} 