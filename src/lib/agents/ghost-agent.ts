import { XMLParser } from 'fast-xml-parser'
import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class GhostAgent extends BaseAgent {
  name = 'Ghost CMS Agent'
  description = 'Specialized agent for Ghost CMS blogs and publications'

  async canHandle(url: string): Promise<number> {
    const domain = new URL(url).hostname
    
    // High confidence for explicit Ghost indicators
    if (url.includes('ghost.') || domain.includes('ghost')) {
      return 0.9
    }
    
    // Known Ghost sites (actual Ghost sites only)
    const knownGhostSites = [
      'blog.openai.com',
      'ghost.org'
    ]
    
    if (knownGhostSites.some(site => domain.includes(site))) {
      return 0.9
    }
    
    // Medium confidence for blog-like domains that might be Ghost
    if (domain.startsWith('blog.') || url.includes('/blog/')) {
      return 0.5  // Lower confidence since many platforms use blog subdomain
    }
    
    return 0.2 // Low default confidence
  }

  async verify(url: string): Promise<boolean> {
    try {
      console.log(`🔍 Ghost Agent: Verifying ${url}`)
      
      const baseUrl = new URL(url).origin
      
      // Method 1: Check for Ghost API endpoint (most reliable)
      try {
        const ghostApiUrl = `${baseUrl}/ghost/api/v4/content/posts/?key=public&limit=1`
        const apiResponse = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(ghostApiUrl)}`))
        if (apiResponse.ok) {
          const content = await apiResponse.text()
          if (content.includes('"posts"') && content.includes('"meta"')) {
            console.log('✅ Ghost Agent: Verified via Ghost API v4')
            return true
          }
        }
      } catch (e) {
        // Try v3 API
        try {
          const ghostApiUrl = `${baseUrl}/ghost/api/v3/content/posts/?key=public&limit=1`
          const apiResponse = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(ghostApiUrl)}`))
          if (apiResponse.ok) {
            const content = await apiResponse.text()
            if (content.includes('"posts"') && content.includes('"meta"')) {
              console.log('✅ Ghost Agent: Verified via Ghost API v3')
              return true
            }
          }
        } catch (e) {
          // API check failed, try other methods
        }
      }
      
      // Method 2: Check HTML for Ghost-specific indicators
      try {
        const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
        if (response.ok) {
          const html = await response.text()
          const ghostIndicators = [
            'generator" content="Ghost',
            '/assets/built/',
            '/ghost/api/',
            'ghost-head',
            'ghost-foot',
            'data-ghost',
            'ghost.min.js'
          ]
          
          const foundIndicators = ghostIndicators.filter(indicator => 
            html.includes(indicator)
          )
          
          if (foundIndicators.length >= 2) {
            console.log(`✅ Ghost Agent: Verified via HTML indicators: ${foundIndicators.join(', ')}`)
            return true
          }
        }
      } catch (e) {
        // HTML check failed
      }
      
      // Method 3: Check sitemap for Ghost patterns
      try {
        const sitemapUrl = `${baseUrl}/sitemap.xml`
        const sitemapResponse = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(sitemapUrl)}`))
        if (sitemapResponse.ok) {
          const sitemapContent = await sitemapResponse.text()
          if (sitemapContent.includes('sitemap-posts.xml') || sitemapContent.includes('sitemap-pages.xml')) {
            console.log('✅ Ghost Agent: Verified via Ghost sitemap structure')
            return true
          }
        }
      } catch (e) {
        // Sitemap check failed
      }
      
      console.log('❌ Ghost Agent: Could not verify as Ghost blog')
      return false
      
    } catch (error) {
      console.log('⚠️ Ghost Agent: Verification error:', error)
      return false
    }
  }

  async collect(url: string): Promise<AgentResult> {
    const startTime = Date.now()
    const articles: HistoricalArticle[] = []
    const errors: string[] = []
    const methodsUsed: string[] = []
    
    try {
      console.log(`👻 Ghost Agent: Starting collection for ${url}`)
      const baseUrl = new URL(url).origin
      
      // Method 1: Try Ghost Content API (primary for Ghost)
      console.log('🔌 Ghost Agent: Trying Ghost Content API...')
      try {
        const apiArticles = await this.collectFromGhostAPI(baseUrl)
        if (apiArticles.length > 0) {
          articles.push(...apiArticles)
          methodsUsed.push('Ghost Content API')
          console.log(`✅ Ghost Agent API: Found ${apiArticles.length} articles`)
        }
      } catch (error) {
        errors.push(`Ghost API: ${error}`)
      }
      
      // Method 2: Try Ghost RSS feeds with pagination
      console.log('📡 Ghost Agent: Trying RSS feeds...')
      const rssUrls = [
        `${baseUrl}/rss/`,
        `${baseUrl}/feed/`,
        `${baseUrl}/atom.xml`
      ]
      
      for (const rssUrl of rssUrls) {
        try {
          const rssArticles = await this.collectFromRSSFeedWithPagination(rssUrl, 10)
          if (rssArticles.length > 0) {
            articles.push(...rssArticles)
            methodsUsed.push(`RSS: ${rssUrl}`)
            console.log(`✅ Ghost Agent RSS: Found ${rssArticles.length} articles from ${rssUrl}`)
            break // Found working RSS feed
          }
        } catch (error) {
          // Continue to next RSS URL
        }
      }
      
      // Method 3: Try Ghost sitemaps (comprehensive for Ghost)
      console.log('🗺️ Ghost Agent: Trying Ghost sitemaps...')
      const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap-posts.xml`
      ]
      
      for (const sitemapUrl of sitemapUrls) {
        try {
          const checkResponse = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(sitemapUrl)}`))
          if (checkResponse.ok) {
            const sitemapArticles = await this.parseSitemap(sitemapUrl)
            if (sitemapArticles.length > 0) {
              articles.push(...sitemapArticles)
              methodsUsed.push(`Sitemap: ${sitemapUrl}`)
              console.log(`✅ Ghost Agent Sitemap: Found ${sitemapArticles.length} articles from ${sitemapUrl}`)
            }
          }
        } catch (error) {
          // Silently skip non-existent sitemaps
        }
      }
      
      // Deduplicate and sort
      const uniqueArticles = this.deduplicateAndSort(articles)
      const totalTime = Date.now() - startTime
      
      console.log(`🎉 Ghost Agent: Collected ${uniqueArticles.length} unique articles in ${totalTime}ms`)
      
      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: this.name,
        confidence: 0.9,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          platformDetected: 'Ghost CMS',
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
        errors: [`Collection failed: ${error}`],
        metadata: {
          platformDetected: 'Ghost CMS',
          methodsUsed,
          totalTime: Date.now() - startTime
        }
      }
    }
  }

  getPlatformIndicators(): PlatformIndicators {
    return {
      urlPatterns: ['ghost.', 'blog.', '/ghost/', '/api/v3/content/'],
      htmlIndicators: ['generator" content="Ghost', '/assets/built/', 'ghost-head'],
      apiEndpoints: ['/ghost/api/v3/content/posts/', '/rss/', '/feed/'],
      confidence: 0.8
    }
  }

  private async collectFromRSSFeedWithPagination(rssUrl: string, maxPages: number = 10): Promise<HistoricalArticle[]> {
    const allArticles: HistoricalArticle[] = []
    
    // First, try the base RSS feed
    const baseArticles = await this.collectFromRSSFeed(rssUrl)
    allArticles.push(...baseArticles)
    
    // Try pagination patterns
    if (baseArticles.length > 0) {
      const paginationPatterns = ['page', 'p']
      
      for (const pattern of paginationPatterns) {
        let page = 2
        let consecutiveEmptyPages = 0
        const maxConsecutiveEmpty = 3
        
        while (page <= maxPages && consecutiveEmptyPages < maxConsecutiveEmpty) {
          try {
            const separator = rssUrl.includes('?') ? '&' : '?'
            const paginatedUrl = `${rssUrl}${separator}${pattern}=${page}`
            
            const pageArticles = await this.collectFromRSSFeed(paginatedUrl)
            
            if (pageArticles.length === 0) {
              consecutiveEmptyPages++
            } else {
              consecutiveEmptyPages = 0
              allArticles.push(...pageArticles)
            }
            
            page++
            await new Promise(resolve => setTimeout(resolve, 1000)) // Rate limiting
            
          } catch (error) {
            consecutiveEmptyPages++
            page++
          }
        }
        
        if (allArticles.length > baseArticles.length) {
          break // Found working pagination
        }
      }
    }
    
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

  private async collectFromGhostAPI(baseUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      // Try Ghost Content API v4 first, then v3
      const apiVersions = [
        { version: 'v4', url: `${baseUrl}/ghost/api/v4/content/posts/?key=public&limit=100` },
        { version: 'v3', url: `${baseUrl}/ghost/api/v3/content/posts/?key=public&limit=100` }
      ]
      
      for (const api of apiVersions) {
        try {
          const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(api.url)}`))
          
          if (response.ok) {
            const data = await response.json()
            
            if (data.posts && Array.isArray(data.posts)) {
              console.log(`✅ Ghost API ${api.version}: Found ${data.posts.length} posts`)
              
              for (const post of data.posts) {
                articles.push({
                  title: post.title || 'Untitled',
                  url: post.url || `${baseUrl}/${post.slug}`,
                  publishedDate: this.parseDate(post.published_at || post.created_at),
                  description: post.excerpt || post.meta_description || '',
                  author: post.primary_author?.name || new URL(baseUrl).hostname
                })
              }
              
              // If we got posts from this API version, use them
              if (articles.length > 0) {
                break
              }
            }
          }
        } catch (versionError) {
          console.log(`⚠️ Ghost API ${api.version} failed:`, versionError)
          continue
        }
      }
      
      if (articles.length === 0) {
        throw new Error('No Ghost API version responded with posts')
      }
      
    } catch (error) {
      throw new Error(`Ghost API failed: ${error}`)
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
} 