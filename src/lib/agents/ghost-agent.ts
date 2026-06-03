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
          const rssArticles = await this.collectFromFeedPaginated(rssUrl, { maxPages: 10 })
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
          const sitemapArticles = await this.parseSitemapRecursive(sitemapUrl)
          if (sitemapArticles.length > 0) {
            articles.push(...sitemapArticles)
            methodsUsed.push(`Sitemap: ${sitemapUrl}`)
            console.log(`✅ Ghost Agent Sitemap: Found ${sitemapArticles.length} articles from ${sitemapUrl}`)
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

  private async collectFromGhostAPI(baseUrl: string): Promise<HistoricalArticle[]> {
    const host = new URL(baseUrl).hostname

    // Ghost's Content API paginates: meta.pagination.{pages,next}. Page through
    // the whole archive instead of taking only the first 100 posts.
    for (const version of ['v4', 'v3']) {
      const articles: HistoricalArticle[] = []
      try {
        let page = 1
        const maxPages = 50 // 50 × 100 = up to 5000 posts
        while (page <= maxPages) {
          const apiUrl = `${baseUrl}/ghost/api/${version}/content/posts/?key=public&limit=100&page=${page}`
          const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(apiUrl)}`))
          if (!response.ok) break

          const data = await response.json()
          if (!data?.posts || !Array.isArray(data.posts) || data.posts.length === 0) break

          for (const post of data.posts) {
            articles.push({
              title: post.title || 'Untitled',
              url: post.url || `${baseUrl}/${post.slug}`,
              publishedDate: this.parseDate(post.published_at || post.created_at),
              description: post.excerpt || post.meta_description || '',
              author: post.primary_author?.name || host,
            })
          }

          const pagination = data.meta?.pagination
          if (pagination?.next) {
            page = pagination.next
          } else if (pagination?.pages && page < pagination.pages) {
            page++
          } else {
            break
          }
          await new Promise(r => setTimeout(r, 300))
        }
      } catch {
        // fall through to next API version
      }

      if (articles.length > 0) {
        console.log(`✅ Ghost API ${version}: ${articles.length} posts (paginated)`)
        return articles
      }
    }

    throw new Error('No Ghost API version responded with posts')
  }
} 