import { XMLParser } from 'fast-xml-parser'
import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class WordPressAgent extends BaseAgent {
  name = 'WordPress Agent'
  description = 'Specialized agent for WordPress blogs and sites'

  async canHandle(url: string): Promise<number> {
    const domain = new URL(url).hostname
    
    // High confidence indicators
    if (url.includes('wordpress') || domain.includes('wordpress')) return 0.9
    if (url.includes('/wp-') || url.includes('/wp/')) return 0.8
    if (domain.endsWith('.wordpress.com')) return 0.95
    
    // Medium confidence indicators for clean WordPress sites
    if (domain === 'waitbutwhy.com') return 0.8  // Known WordPress site
    
    // WordPress-style URL patterns
    const wpUrlPatterns = [
      /\/\d{4}\/\d{2}\/[^\/]+\/?$/,  // /2024/04/post-name/
      /\/\d{4}\/[^\/]+\.html?$/,     // /2024/post-name.html
      /\/category\/[^\/]+\/?$/,      // /category/tech/
      /\/tag\/[^\/]+\/?$/,           // /tag/science/
      /\/author\/[^\/]+\/?$/,        // /author/username/
      /\/page\/\d+\/?$/              // /page/2/
    ]
    
    if (wpUrlPatterns.some(pattern => pattern.test(url))) return 0.6
    
    // Common WordPress domains and patterns
    const wpDomainPatterns = [
      /\.blog$/,                     // .blog TLD often WordPress
      /blog\./,                      // blog.example.com
      /\/blog/                       // example.com/blog
    ]
    
    if (wpDomainPatterns.some(pattern => pattern.test(url) || pattern.test(domain))) return 0.5
    
    return 0.2
  }

  async verify(url: string): Promise<boolean> {
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
      if (!response.ok) return false
      
      const html = await response.text()
      
      const wpIndicators = [
        'wp-content', 'wp-includes', 'wordpress', 'generator" content="WordPress',
        '/wp-json/', 'wp-admin', 'wp-login'
      ]
      
      return wpIndicators.some(indicator => html.includes(indicator))
    } catch {
      return false
    }
  }

  async collect(url: string): Promise<AgentResult> {
    const startTime = Date.now()
    const articles: HistoricalArticle[] = []
    const errors: string[] = []
    const methodsUsed: string[] = []
    
    try {
      const baseUrl = new URL(url).origin
      
      // Method 1: WordPress REST API
      try {
        const apiArticles = await this.collectFromWordPressAPI(baseUrl)
        if (apiArticles.length > 0) {
          articles.push(...apiArticles)
          methodsUsed.push('WordPress REST API')
        }
      } catch (error) {
        errors.push(`WordPress API: ${error}`)
      }
      
      // Method 2: RSS feeds
      const rssUrls = [
        `${baseUrl}/feed/`,
        `${baseUrl}/rss/`,
        `${baseUrl}/?feed=rss2`,
        `${baseUrl}/wp-rss2.php`
      ]
      
      for (const rssUrl of rssUrls) {
        try {
          const rssArticles = await this.collectFromRSSFeed(rssUrl)
          if (rssArticles.length > 0) {
            articles.push(...rssArticles)
            methodsUsed.push(`RSS: ${rssUrl}`)
            break
          }
        } catch {
          // Continue to next RSS URL
        }
      }
      
      // Method 3: Enhanced Sitemap Discovery
      const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/post-sitemap.xml`,
        `${baseUrl}/posts-sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemap-posts.xml`,
        `${baseUrl}/wp-sitemap.xml`,
        `${baseUrl}/wp-sitemap-posts-1.xml`
      ]
      
      for (const sitemapUrl of sitemapUrls) {
        try {
          const sitemapArticles = await this.collectFromSitemap(sitemapUrl)
          if (sitemapArticles.length > 0) {
            console.log(`🗺️ WordPress Agent: Found ${sitemapArticles.length} articles from ${sitemapUrl}`)
            articles.push(...sitemapArticles)
            methodsUsed.push(`Sitemap: ${sitemapUrl}`)
            break // Use first successful sitemap
          }
        } catch {
          // Continue to next sitemap URL
        }
      }
      
      // Method 4: Archive Page Discovery (for blogs with archive pages)
      try {
        const archiveArticles = await this.collectFromArchivePages(baseUrl)
        if (archiveArticles.length > 0) {
          console.log(`📚 WordPress Agent: Found ${archiveArticles.length} articles from archive pages`)
          articles.push(...archiveArticles)
          methodsUsed.push('Archive Pages')
        }
      } catch {
        // Archive collection failed
      }
      
      const uniqueArticles = this.deduplicateAndSort(articles)
      
      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: this.name,
        confidence: 0.9,
        metadata: {
          platformDetected: 'WordPress',
          methodsUsed,
          totalTime: Date.now() - startTime
        }
      }
    } catch (error) {
      return {
        success: false,
        articles: [],
        articlesFound: 0,
        strategy: this.name,
        confidence: 0.1,
        errors: [`Collection failed: ${error}`]
      }
    }
  }

  getPlatformIndicators(): PlatformIndicators {
    return {
      urlPatterns: ['wordpress.com', '/wp-', '/wp/'],
      htmlIndicators: ['wp-content', 'generator" content="WordPress'],
      apiEndpoints: ['/wp-json/wp/v2/posts', '/feed/', '/sitemap.xml'],
      confidence: 0.9
    }
  }

  private async collectFromWordPressAPI(baseUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      console.log(`📡 WordPress Agent: Starting comprehensive API collection for ${baseUrl}`)
      
      // Get total posts count first
      let page = 1
      const perPage = 100
      let hasMorePages = true
      
      while (hasMorePages && page <= 50) { // Safety limit of 50 pages (5000 posts)
        const apiUrl = `${baseUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&status=publish&orderby=date&order=desc`
        console.log(`📄 WordPress Agent: Fetching page ${page} (${perPage} posts per page)`)
        
        try {
          const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(apiUrl)}`))
          
          if (!response.ok) {
            if (response.status === 400) {
              console.log(`📄 WordPress Agent: Page ${page} returned 400 (no more pages)`)
              break
            }
            throw new Error(`HTTP ${response.status}`)
          }
          
          const posts = await response.json()
          
          if (!Array.isArray(posts) || posts.length === 0) {
            console.log(`📄 WordPress Agent: Page ${page} has no posts, stopping pagination`)
            break
          }
          
          console.log(`📄 WordPress Agent: Page ${page} returned ${posts.length} posts`)
          
          for (const post of posts) {
            articles.push({
              title: post.title?.rendered || 'Untitled',
              url: post.link || `${baseUrl}/?p=${post.id}`,
              publishedDate: this.parseDate(post.date || post.date_gmt),
              description: post.excerpt?.rendered?.replace(/<[^>]+>/g, '').substring(0, 200) || '',
              author: post.author_name || new URL(baseUrl).hostname
            })
          }
          
          // Check if we have more pages
          if (posts.length < perPage) {
            console.log(`📄 WordPress Agent: Page ${page} returned ${posts.length} < ${perPage} posts, no more pages`)
            hasMorePages = false
          } else {
            page++
          }
          
        } catch (pageError) {
          console.log(`📄 WordPress Agent: Page ${page} failed: ${pageError}`)
          // If this page fails, try next page (maybe some pages are empty)
          if (page < 5) {
            page++
            continue
          } else {
            break // Stop if we've tried several pages
          }
        }
      }
      
      console.log(`📡 WordPress Agent: Collected ${articles.length} articles via REST API`)
      
    } catch (error) {
      throw new Error(`WordPress API failed: ${error}`)
    }
    
    return articles
  }

  private async collectFromRSSFeed(rssUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      const proxyUrl = this.getAbsoluteUrl(`/api/rss-proxy?url=${encodeURIComponent(rssUrl)}`)
      const response = await fetch(proxyUrl)
      
      if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`)

      const rssXml = await response.text()
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text'
      })
      
      const xmlDoc = parser.parse(rssXml)
      
      let items: any[] = []
      if (xmlDoc.rss && xmlDoc.rss.channel && xmlDoc.rss.channel.item) {
        items = Array.isArray(xmlDoc.rss.channel.item) ? xmlDoc.rss.channel.item : [xmlDoc.rss.channel.item]
      }
      
      for (const item of items) {
        try {
          const title = item.title?.['#text'] || item.title
          const link = item.link?.['#text'] || item.link
          const pubDate = item.pubDate
          const description = item.description?.['#text'] || item.description
          
          if (title && link) {
            articles.push({
              title: typeof title === 'string' ? title.trim() : String(title).trim(),
              url: typeof link === 'string' ? link.trim() : String(link).trim(),
              publishedDate: pubDate ? this.parseDate(String(pubDate)) : new Date().toISOString(),
              description: description ? String(description).replace(/<[^>]+>/g, '').substring(0, 200) : '',
              author: new URL(rssUrl).hostname
            })
          }
        } catch {
          // Skip invalid items
        }
      }
    } catch (error) {
      throw new Error(`RSS collection failed: ${error}`)
    }
    
    return articles
  }

  private async collectFromSitemap(sitemapUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(sitemapUrl)}`))
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const xml = await response.text()
      const parser = new XMLParser({ ignoreAttributes: false })
      const xmlDoc = parser.parse(xml)

      if (xmlDoc.urlset && xmlDoc.urlset.url) {
        let urls = Array.isArray(xmlDoc.urlset.url) ? xmlDoc.urlset.url : [xmlDoc.urlset.url]

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
    const segments = url.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    
    if (lastSegment && lastSegment !== '') {
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
    }
    
    return 'Untitled Article'
  }

  private async collectFromArchivePages(baseUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      // Try common WordPress archive URLs
      const archiveUrls = [
        `${baseUrl}/archive`,
        `${baseUrl}/archives`,
        `${baseUrl}/all-posts`,
        `${baseUrl}/posts`,
        `${baseUrl}/blog`
      ]
      
      for (const archiveUrl of archiveUrls) {
        try {
          console.log(`📚 WordPress Agent: Checking archive page ${archiveUrl}`)
          const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(archiveUrl)}`))
          
          if (!response.ok) continue
          
          const html = await response.text()
          const archiveArticles = this.extractArticlesFromArchivePage(html, baseUrl)
          
          if (archiveArticles.length > 0) {
            console.log(`📚 WordPress Agent: Found ${archiveArticles.length} articles from ${archiveUrl}`)
            articles.push(...archiveArticles)
            break // Use first successful archive page
          }
        } catch {
          // Continue to next archive URL
        }
      }
      
      // Also try year-based archives if we didn't find a main archive page
      if (articles.length === 0) {
        const currentYear = new Date().getFullYear()
        const startYear = currentYear - 15 // Go back 15 years
        
        for (let year = currentYear; year >= startYear && articles.length < 1000; year--) {
          try {
            const yearArchiveUrl = `${baseUrl}/${year}/`
            console.log(`📅 WordPress Agent: Checking year archive ${year}`)
            
            const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(yearArchiveUrl)}`))
            if (!response.ok) continue
            
            const html = await response.text()
            const yearArticles = this.extractArticlesFromArchivePage(html, baseUrl)
            
            if (yearArticles.length > 0) {
              console.log(`📅 WordPress Agent: Found ${yearArticles.length} articles from ${year}`)
              articles.push(...yearArticles)
            }
          } catch {
            // Continue to next year
          }
        }
      }
      
    } catch (error) {
      console.log(`📚 WordPress Agent: Archive collection failed: ${error}`)
    }
    
    return articles
  }

  private extractArticlesFromArchivePage(html: string, baseUrl: string): HistoricalArticle[] {
    const articles: HistoricalArticle[] = []
    
    try {
      // Clean HTML
      const cleanHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      
      // Look for article links with various patterns
      const linkPatterns = [
        // Standard WordPress post links
        /<a[^>]*href="([^"]*\/\d{4}\/\d{2}\/[^"]*)"[^>]*>([^<]+)<\/a>/gi,
        // Generic article links with titles
        /<a[^>]*href="([^"]*)"[^>]*class="[^"]*(?:post|article|entry)[^"]*"[^>]*>([^<]+)<\/a>/gi,
        // Archive page list items
        /<li[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>.*?(\d{4}|\w+\s+\d{1,2},?\s+\d{4})/gi,
        // Title and date combinations
        /<h\d[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h\d>/gi
      ]
      
      for (const pattern of linkPatterns) {
        let match
        while ((match = pattern.exec(cleanHtml)) !== null && articles.length < 500) {
          const [, url, title] = match
          
          if (url && title && this.looksLikeArticle(url)) {
            // Extract date if available in surrounding context
            let publishedDate = new Date().toISOString()
            
            // Look for date patterns near the link
            const contextStart = Math.max(0, match.index - 200)
            const contextEnd = Math.min(cleanHtml.length, match.index + match[0].length + 200)
            const context = cleanHtml.substring(contextStart, contextEnd)
            
            const dateMatch = context.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})|(\w+)\s+(\d{1,2}),?\s+(\d{4})/i)
            if (dateMatch) {
              try {
                if (dateMatch[1]) {
                  // YYYY-MM-DD format
                  publishedDate = new Date(`${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`).toISOString()
                } else if (dateMatch[4]) {
                  // Month DD, YYYY format
                  publishedDate = new Date(`${dateMatch[4]} ${dateMatch[5]}, ${dateMatch[6]}`).toISOString()
                }
              } catch {
                // Keep default date
              }
            }
            
            articles.push({
              title: title.trim(),
              url: url.startsWith('http') ? url : new URL(url, baseUrl).href,
              publishedDate,
              description: `Historical article from ${new URL(baseUrl).hostname}`,
              author: new URL(baseUrl).hostname
            })
          }
        }
      }
      
    } catch (error) {
      console.log(`📚 WordPress Agent: Archive parsing failed: ${error}`)
    }
    
    return articles
  }
} 