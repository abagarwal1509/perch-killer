import { XMLParser } from 'fast-xml-parser'
import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class SubstackAgent extends BaseAgent {
  name = 'Substack Agent'
  description = 'Specialized agent for Substack newsletters'

  async canHandle(url: string): Promise<number> {
    const domain = new URL(url).hostname
    const urlPath = new URL(url).pathname
    
    // BULLETPROOF SUBSTACK DETECTION - NEVER MISS AGAIN!
    
    // 1. OBVIOUS SUBSTACK DOMAINS - 95% confidence
    if (domain.endsWith('.substack.com')) return 0.95
    if (url.includes('substack')) return 0.8
    
    // 2. STRUCTURAL URL PATTERNS - Strong Substack indicators - 90% confidence
    // Check for /p/ pattern (Substack post URLs always use /p/article-name)
    if (url.includes('/p/') || urlPath.includes('/p/')) {
      console.log(`🎯 Substack Agent: Found /p/ pattern in URL - strong Substack indicator`)
      return 0.9
    }
    
    // 3. ENHANCED CONTENT-BASED DETECTION - 85-90% confidence
    const contentConfidence = await this.performDeepSubstackAnalysis(url)
    if (contentConfidence >= 0.85) {
      console.log(`🎯 Substack Agent: Deep analysis confidence: ${contentConfidence}`)
      return contentConfidence
    }
    
    // 4. RSS FEED STRUCTURE ANALYSIS - 85% confidence
    const rssConfidence = await this.analyzeRSSForSubstack(url)
    if (rssConfidence >= 0.85) {
      console.log(`🎯 Substack Agent: RSS analysis indicates Substack: ${rssConfidence}`)
      return rssConfidence
    }
    
    // 5. EXPANDED KNOWN CUSTOM DOMAINS - 90% confidence
    const knownSubstackCustomDomains = [
      'growthunhinged.com',
      'argmin.net', // Ben Recht's blog
      'stratechery.com',
      'morningbrew.com',
      'thehustle.co',
      'lennysnewsletter.com',
      'platformer.news',
      'casey.news',
      'kylepoyas.com',
      'noahpinion.blog',
      'astralcodexten.substack.com',
      'danluu.com',
      'birdsite.xavin.com',
      'newsletter.pragmaticengineer.com',
      'sethgodin.typepad.com'
    ]
    
    if (knownSubstackCustomDomains.some(d => domain.includes(d) || d.includes(domain))) {
      console.log(`🎯 Substack Agent: Found in known custom domains list`)
      return 0.9
    }
    
    // 6. NEWSLETTER DOMAIN PATTERNS - 60% confidence
    if (domain.includes('newsletter') || url.includes('newsletter')) return 0.6
    
    // 7. SOPHISTICATED DOMAIN ANALYSIS - Check for custom domain newsletters
    if (await this.isLikelyCustomDomainNewsletter(domain, url)) {
      console.log(`🎯 Substack Agent: Appears to be custom domain newsletter`)
      return 0.7
    }
    
    // Fallback - still give a chance for content detection
    return Math.max(contentConfidence, 0.1)
  }

  private async performDeepSubstackAnalysis(url: string): Promise<number> {
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
      if (!response.ok) return 0.1
      
      const html = await response.text()
      let confidence = 0.1
      
      // SUPER STRONG INDICATORS - 95% confidence
      const superStrongIndicators = [
        'substack.com', 'substackcdn.com', 'cdn.substack.com',
        'substack-post-embed', 'substack-frontend', 'substack-iframe',
        '_preload_substack', 'substack-widget', 'substack-embed'
      ]
      
      if (superStrongIndicators.some(indicator => html.toLowerCase().includes(indicator.toLowerCase()))) {
        confidence = Math.max(confidence, 0.95)
      }
      
      // STRONG INDICATORS - 90% confidence
      const strongIndicators = [
        'powered by substack', 'substack reader', 'substack profile',
        'subscribe via email', 'give a gift subscription',
        'share this newsletter', 'substack publication'
      ]
      
      if (strongIndicators.some(indicator => html.toLowerCase().includes(indicator.toLowerCase()))) {
        confidence = Math.max(confidence, 0.9)
      }
      
      // META TAG ANALYSIS - 85% confidence
      const metaTagPatterns = [
        /<meta[^>]*property="og:site_name"[^>]*content="[^"]*substack[^"]*"/i,
        /<meta[^>]*name="generator"[^>]*content="[^"]*substack[^"]*"/i,
        /<link[^>]*rel="canonical"[^>]*href="[^"]*substack\.com[^"]*"/i
      ]
      
      if (metaTagPatterns.some(pattern => pattern.test(html))) {
        confidence = Math.max(confidence, 0.85)
      }
      
      // URL STRUCTURE IN HTML - 85% confidence
      const urlPatterns = [
        /\/p\/[a-z0-9-]+/g, // /p/article-slug pattern
        /\/subscribe/g,
        /\/archive/g
      ]
      
      const urlMatches = urlPatterns.reduce((count, pattern) => {
        const matches = html.match(pattern)
        return count + (matches ? matches.length : 0)
      }, 0)
      
      if (urlMatches > 3) {
        confidence = Math.max(confidence, 0.85)
      }
      
      // MEDIUM INDICATORS - 70% confidence
      const mediumIndicators = [
        'share this post', 'subscribe', 'subscribers',
        'newsletter', 'weekly', 'monthly', 'email list'
      ]
      
      const mediumMatches = mediumIndicators.filter(indicator => 
        html.toLowerCase().includes(indicator.toLowerCase())
      ).length
      
      if (mediumMatches >= 3) {
        confidence = Math.max(confidence, 0.7)
      }
      
      // JAVASCRIPT/CSS ANALYSIS - 80% confidence
      const scriptPatterns = [
        /substack/gi,
        /_substack_/gi,
        /substackcdn/gi
      ]
      
      if (scriptPatterns.some(pattern => pattern.test(html))) {
        confidence = Math.max(confidence, 0.8)
      }
      
      console.log(`🔍 Substack Agent: Deep analysis confidence: ${confidence}`)
      return confidence
      
    } catch (error) {
      console.log(`⚠️ Deep analysis failed: ${error}`)
      return 0.1
    }
  }

  private async analyzeRSSForSubstack(url: string): Promise<number> {
    const baseUrl = new URL(url).origin
    const possibleFeeds = [
      `${baseUrl}/feed`,
      `${baseUrl}/feed.xml`,
      `${baseUrl}/rss`,
      `${baseUrl}/rss.xml`
    ]
    
    for (const feedUrl of possibleFeeds) {
      try {
        const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(feedUrl)}`))
        if (!response.ok) continue
        
        const xmlContent = await response.text()
        
        // Check for Substack-specific RSS patterns
        const substackRSSIndicators = [
          /<link>.*substack\.com.*<\/link>/i,
          /<managingEditor>.*substack\.com.*<\/managingEditor>/i,
          /<generator>.*substack.*<\/generator>/i,
          /<atom:link.*substack.*>/i,
          /\/p\/[a-z0-9-]+/g // Substack post URL pattern in RSS
        ]
        
        const indicatorMatches = substackRSSIndicators.filter(pattern => 
          pattern.test(xmlContent)
        ).length
        
        if (indicatorMatches >= 2) {
          console.log(`📡 RSS analysis found ${indicatorMatches} Substack indicators`)
          return 0.9
        } else if (indicatorMatches >= 1) {
          return 0.7
        }
        
      } catch (error) {
        // Continue to next feed
      }
    }
    
    return 0.1
  }

  private async isLikelyCustomDomainNewsletter(domain: string, url: string): Promise<boolean> {
    // Check domain structure patterns typical of newsletter sites
    const parts = domain.split('.')
    
    // Single word domains with common TLDs are often custom newsletters
    if (parts.length === 2 && ['com', 'net', 'org', 'blog', 'news'].includes(parts[1])) {
      
      // Skip obvious non-newsletter domains
      const skipPatterns = [
        'google', 'facebook', 'twitter', 'github', 'youtube',
        'amazon', 'microsoft', 'apple', 'reddit', 'wikipedia',
        'stackoverflow', 'linkedin', 'instagram', 'tiktok'
      ]
      
      if (skipPatterns.some(pattern => domain.includes(pattern))) {
        return false
      }
      
      // Check for newsletter-like URL patterns
      const newsletterURLPatterns = [
        '/subscribe', '/newsletter', '/archive', '/posts', '/issues', '/p/'
      ]
      
      return newsletterURLPatterns.some(pattern => url.includes(pattern))
    }
    
    return false
  }

  async verify(url: string): Promise<boolean> {
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
      if (!response.ok) return false
      
      const html = await response.text()
      
      const substackIndicators = [
        'substack', 'Substack', 'substack.com',
        '_preload_substack', 'substackcdn.com',
        'substack-post-embed', 'substack-embed',
        'cdn.substack.com', 'substack-frontend',
        // Custom domain indicators
        'Subscribe via email', 'Share this post',
        'Give a gift subscription', 'Share this newsletter',
        'powered by Substack', 'Substack Reader',
        'substack-iframe', 'substack-widget'
      ]
      
      return substackIndicators.some(indicator => html.includes(indicator))
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
      const domain = new URL(url).hostname
      
      console.log(`📡 Substack Agent: Starting collection for ${domain}`)
      
      // Method 1: Enhanced RSS feed collection (custom domains often use different paths)
      const rssUrls = [
        `${baseUrl}/feed`,
        `${baseUrl}/feed.xml`,
        `${baseUrl}/rss`,
        `${baseUrl}/rss.xml`,
        // Custom domain alternatives
        `${baseUrl}/newsletter/feed`,
        `${baseUrl}/posts/feed`,
        `${baseUrl}/index.xml`,
        `${baseUrl}/atom.xml`,
        // Substack-specific patterns
        `${baseUrl}/feed.rss`,
        `${baseUrl}/newsletters/feed`
      ]
      
      for (const rssUrl of rssUrls) {
        try {
          console.log(`📡 Substack Agent: Trying RSS feed ${rssUrl}`)
          const rssArticles = await this.collectFromRSSFeed(rssUrl)
          if (rssArticles.length > 0) {
            console.log(`📡 Substack Agent: Found ${rssArticles.length} articles from RSS`)
            articles.push(...rssArticles)
            methodsUsed.push(`Substack RSS: ${rssUrl}`)
            break // Use first successful RSS feed
          }
        } catch (error) {
          console.log(`📡 Substack Agent: RSS ${rssUrl} failed: ${error}`)
        }
      }
      
      // Method 2: Enhanced Archive Page Collection (custom domains use different structures)
      const archiveUrls = [
        `${baseUrl}/archive`,
        `${baseUrl}/archive?sort=new`,
        `${baseUrl}/archive?sort=old`,
        `${baseUrl}/posts`,
        `${baseUrl}/newsletter`,
        `${baseUrl}/newsletters`,
        `${baseUrl}/articles`,
        `${baseUrl}/issues`,
        // Pagination attempts
        `${baseUrl}/archive?page=1`,
        `${baseUrl}/archive?page=2`,
        `${baseUrl}/archive?page=3`,
        // Date-based archives
        `${baseUrl}/archive/2024`,
        `${baseUrl}/archive/2023`,
        // Sitemap
        `${baseUrl}/sitemap.xml`
      ]
      
      for (const archiveUrl of archiveUrls) {
        try {
          console.log(`📚 Substack Agent: Trying archive ${archiveUrl}`)
          const archiveArticles = await this.collectFromArchivePage(archiveUrl)
          if (archiveArticles.length > 0) {
            console.log(`📚 Substack Agent: Found ${archiveArticles.length} articles from ${archiveUrl}`)
            articles.push(...archiveArticles)
            methodsUsed.push(`Archive: ${archiveUrl}`)
            
            // If we found a lot of articles from archive, stop here
            if (archiveArticles.length > 30) break
          }
        } catch (error) {
          console.log(`⚠️ Archive ${archiveUrl} failed: ${error}`)
        }
      }

      // Method 3: Enhanced sitemap collection
      try {
        console.log(`🗺️ Substack Agent: Collecting from sitemap`)
        const sitemapArticles = await this.collectFromSitemap(`${baseUrl}/sitemap.xml`)
        if (sitemapArticles.length > 0) {
          console.log(`🗺️ Substack Agent: Found ${sitemapArticles.length} articles from sitemap`)
          articles.push(...sitemapArticles)
          methodsUsed.push('Sitemap')
        }
      } catch (error) {
        console.log(`⚠️ Sitemap collection failed: ${error}`)
        errors.push(`Sitemap: ${error}`)
      }
      
      // Method 4: Custom domain specific methods (try to scrape main page for newsletter structure)
      if (!domain.endsWith('.substack.com') && articles.length < 30) {
        try {
          console.log(`🏠 Substack Agent: Trying main page scraping for custom domain`)
          const mainPageArticles = await this.collectFromMainPage(baseUrl)
          if (mainPageArticles.length > 0) {
            console.log(`🏠 Substack Agent: Found ${mainPageArticles.length} articles from main page`)
            articles.push(...mainPageArticles)
            methodsUsed.push('Main Page Scraping')
          }
        } catch (error) {
          console.log(`⚠️ Main page scraping failed: ${error}`)
        }
      }
      
      const uniqueArticles = this.deduplicateAndSort(articles)
      
      console.log(`🎉 Substack Agent: Completed collection for ${domain} - ${uniqueArticles.length} articles found`)
      
      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: this.name,
        confidence: 0.9,
        metadata: {
          platformDetected: `Substack${domain.endsWith('.substack.com') ? '' : ' (Custom Domain)'}`,
          methodsUsed,
          totalTime: Date.now() - startTime
        }
      }
    } catch (error) {
      console.error(`❌ Substack Agent collection failed for ${url}:`, error)
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
      urlPatterns: ['.substack.com', 'substack'],
      htmlIndicators: ['substack', 'substackcdn.com', '_preload_substack'],
      apiEndpoints: ['/feed', '/archive'],
      confidence: 0.9
    }
  }

  private async collectFromRSSFeed(rssUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      console.log(`📡 Substack Agent: Collecting from RSS feed ${rssUrl}`)
      const response = await fetch(this.getAbsoluteUrl(`/api/rss-proxy?url=${encodeURIComponent(rssUrl)}`))
      
      if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`)
      
      const rssText = await response.text()
      console.log(`📡 Substack Agent: Got RSS content (${rssText.length} chars)`)
      
      // Extract items using proper RSS parsing
      const itemMatches = rssText.match(/<item>[\s\S]*?<\/item>/gi)
      
      if (!itemMatches) {
        console.log(`⚠️ Substack Agent: No RSS items found`)
        return articles
      }
      
      console.log(`📡 Substack Agent: Found ${itemMatches.length} RSS items`)
      
      for (let i = 0; i < itemMatches.length; i++) {
        const item = itemMatches[i]
        try {
          // Extract title from CDATA - try multiple patterns
          let title = null
          const titlePatterns = [
            /<title><!\[CDATA\[(.*?)\]\]><\/title>/,
            /<title>(.*?)<\/title>/
          ]
          
          for (const pattern of titlePatterns) {
            const match = item.match(pattern)
            if (match) {
              title = match[1].trim()
              break
            }
          }
          
          // Extract link
          const linkMatch = item.match(/<link>(.*?)<\/link>/)
          const url = linkMatch ? linkMatch[1].trim() : null
          
          // Extract date
          const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/)
          const dateStr = dateMatch ? dateMatch[1].trim() : null
          
          console.log(`🔍 RSS Item ${i + 1}: title="${title}" url="${url}"`)
          
          if (title && url) {
            // Validate it's a real article URL
            if (url.includes('/p/') || url.includes('substack.com')) {
              // Parse date
              let publishedDate = new Date()
              if (dateStr) {
                try {
                  publishedDate = new Date(dateStr)
                } catch (e) {
                  console.log(`⚠️ Date parse error: ${dateStr}`)
                }
              }
              
              const cleanTitle = this.cleanTitle(title)
              
              // Additional validation - skip UI elements
              if (!this.isValidSubstackTitle(cleanTitle)) {
                console.log(`⚠️ Skipping invalid title: "${cleanTitle}"`)
                continue
              }
              
              articles.push({
                title: cleanTitle,
                url: url,
                publishedDate: publishedDate.toISOString(),
                description: title.length > 50 ? title.substring(0, 200) + '...' : title
              })
              
              console.log(`✅ Substack RSS: "${cleanTitle}" (${publishedDate.toISOString().split('T')[0]})`)
            } else {
              console.log(`⚠️ Invalid URL: ${url}`)
            }
          } else {
            console.log(`⚠️ Missing title or URL in RSS item ${i + 1}`)
          }
        } catch (error) {
          console.log(`⚠️ Error parsing RSS item ${i + 1}: ${error}`)
        }
      }
      
    } catch (error) {
      console.log(`❌ Substack Agent RSS error: ${error}`)
    }
    
    console.log(`📡 Substack Agent: Found ${articles.length} articles from RSS`)
    return articles
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
  }

  private extractCleanDescription(html: string): string {
    if (!html) return ''
    
    // Remove all HTML tags and get first 200 chars
    const cleanText = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
    
    return cleanText.length > 200 ? cleanText.substring(0, 200) + '...' : cleanText
  }

  private async collectFromArchivePage(archiveUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      console.log(`📚 Substack Agent: Collecting from archive page ${archiveUrl}`)
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(archiveUrl)}`))
      
      if (!response.ok) throw new Error(`Archive page fetch failed: ${response.status}`)
      
      const html = await response.text()
      const baseUrl = new URL(archiveUrl).origin
      
      // Clean HTML and remove UI elements
      const cleanHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
      
      console.log(`📄 Substack Agent: Processing HTML (${cleanHtml.length} chars)`)
      
      // Multiple extraction patterns for Substack's various layouts
      const extractionMethods = [
        // Method 1: Direct title-link patterns (most reliable)
        {
          name: 'Direct Title Links',
          pattern: /<h[1-6][^>]*>\s*<a[^>]*href="([^"]*\/p\/[^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h[1-6]>/gi
        },
        // Method 2: Article containers with links
        {
          name: 'Article Containers',
          pattern: /<article[^>]*>[\s\S]*?<a[^>]*href="([^"]*\/p\/[^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi
        },
        // Method 3: Post title divs
        {
          name: 'Post Title Divs',
          pattern: /<div[^>]*class="[^"]*post-title[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*\/p\/[^"]*)"[^>]*>([^<]+)<\/a>/gi
        },
        // Method 4: Substack-specific post preview containers
        {
          name: 'Post Preview Containers',
          pattern: /<div[^>]*class="[^"]*post-preview[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*\/p\/[^"]*)"[^>]*[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi
        }
      ]
      
      for (const method of extractionMethods) {
        console.log(`🔍 Substack Agent: Trying ${method.name}`)
        let match
        let methodCount = 0
        
        // Reset regex lastIndex for each method
        method.pattern.lastIndex = 0
        
        while ((match = method.pattern.exec(cleanHtml)) !== null && methodCount < 50) {
          const [, url, title] = match
          
          if (title && url && this.isValidSubstackTitle(title)) {
            const fullUrl = url.startsWith('/') ? baseUrl + url : url
            
            // Extract date from URL if possible
            const dateMatch = url.match(/\/p\/[^/]*-([a-f0-9]+)/)
            let publishedDate = new Date().toISOString()
            
            // Try to extract date from surrounding context
            const contextStart = Math.max(0, match.index - 300)
            const contextEnd = Math.min(cleanHtml.length, match.index + match[0].length + 300)
            const context = cleanHtml.substring(contextStart, contextEnd)
            
            const datePatterns = [
              /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
              /(\d{4})-(\d{2})-(\d{2})/,
              /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
            ]
            
            for (const datePattern of datePatterns) {
              const dateMatch = context.match(datePattern)
              if (dateMatch) {
                try {
                  if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
                    if (dateMatch[0].includes('-')) {
                      // YYYY-MM-DD format
                      publishedDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`).toISOString()
                    } else {
                      // Month Day, Year format
                      publishedDate = new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`).toISOString()
                    }
                  }
                  break
                } catch {
                  // Keep default date
                }
              }
            }
            
            console.log(`📝 Substack Agent: Found article - "${title.substring(0, 50)}..." via ${method.name}`)
            
            articles.push({
              title: title.trim(),
              url: fullUrl,
              publishedDate,
              description: `Newsletter post from ${new URL(baseUrl).hostname.replace('.substack.com', '')}`,
              author: new URL(baseUrl).hostname.replace('.substack.com', '')
            })
            
            methodCount++
          }
        }
        
        console.log(`📊 Substack Agent: ${method.name} found ${methodCount} articles`)
        
        // If we found articles with this method, we can stop trying other methods
        if (methodCount > 0) {
          break
        }
      }
      
      console.log(`📚 Substack Agent: Total articles found from archive: ${articles.length}`)
      
    } catch (error) {
      throw new Error(`Archive page parsing failed: ${error}`)
    }
    
    return articles
  }

  private isValidSubstackTitle(title: string): boolean {
    if (!title || title.length < 3) return false
    
    const invalidPatterns = [
      /^share$/i,
      /^share this post$/i,
      /^like$/i,
      /^comment$/i,
      /^subscribe$/i,
      /^read more$/i,
      /^continue reading$/i,
      /^january|february|march|april|may|june|july|august|september|october|november|december$/i,
      /^\d{4}$/,
      /^share this$/i,
      /^get \d+% off$/i,
      /^upgrade to paid$/i
    ]
    
    return !invalidPatterns.some(pattern => pattern.test(title.trim()))
  }

  private async collectFromSitemap(sitemapUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      console.log(`🗺️ Substack Agent: Fetching sitemap ${sitemapUrl}`)
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(sitemapUrl)}`))
      
      if (!response.ok) throw new Error(`Sitemap fetch failed: ${response.status}`)
      
      const xmlText = await response.text()
      console.log(`🗺️ Substack Agent: Got sitemap content (${xmlText.length} chars)`)
      
      // Extract URLs from sitemap XML
      const urlMatches = xmlText.match(/<url>[\s\S]*?<\/url>/gi)
      
      if (!urlMatches) {
        console.log(`⚠️ No URLs found in sitemap`)
        return articles
      }
      
      console.log(`🗺️ Found ${urlMatches.length} URLs in sitemap`)
      
      for (const urlBlock of urlMatches) {
        try {
          // Extract location (URL)
          const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/)
          const url = locMatch ? locMatch[1].trim() : null
          
          // Extract last modified date
          const lastModMatch = urlBlock.match(/<lastmod>(.*?)<\/lastmod>/)
          const lastMod = lastModMatch ? lastModMatch[1].trim() : null
          
          // Only process article URLs (contain /p/)
          if (url && url.includes('/p/')) {
            // Extract title from URL slug
            const titleFromUrl = this.extractTitleFromUrl(url)
            
            // Parse date
            let publishedDate = new Date()
            if (lastMod) {
              try {
                publishedDate = new Date(lastMod)
              } catch (e) {
                console.log(`⚠️ Date parse error: ${lastMod}`)
              }
            }
            
            articles.push({
              title: titleFromUrl,
              url: url,
              publishedDate: publishedDate.toISOString(),
              description: `Article from ${publishedDate.toISOString().split('T')[0]}`
            })
            
            console.log(`✅ Sitemap: "${titleFromUrl}" (${publishedDate.toISOString().split('T')[0]})`)
          }
        } catch (error) {
          console.log(`⚠️ Error parsing sitemap URL: ${error}`)
        }
      }
      
    } catch (error) {
      console.log(`❌ Sitemap collection error: ${error}`)
      throw error
    }
    
    console.log(`🗺️ Substack Agent: Found ${articles.length} articles from sitemap`)
    return articles
  }

  private extractTitleFromUrl(url: string): string {
    try {
      // Extract the slug from URLs like https://rentfreewithayan.substack.com/p/article-slug
      const urlParts = url.split('/p/')
      if (urlParts.length > 1) {
        const slug = urlParts[1].split('?')[0] // Remove query params
        
        // Convert slug to title
        return slug
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
      }
    } catch (error) {
      console.log(`⚠️ Error extracting title from URL: ${url}`)
    }
    
    return 'Untitled Article'
  }

  private async collectFromMainPage(baseUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      console.log(`🏠 Substack Agent: Collecting from main page ${baseUrl}`)
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(baseUrl)}`))
      
      if (!response.ok) throw new Error(`Main page fetch failed: ${response.status}`)
      
      const html = await response.text()
      
      // Look for Substack indicators on main page
      const substackIndicators = [
        'substack', 'Substack', 'substack.com',
        'substackcdn.com', 'cdn.substack.com',
        'substack-post-embed', 'substack-frontend',
        'Subscribe via email', 'Share this post',
        'Give a gift subscription', 'Share this newsletter',
        'powered by Substack', 'Substack Reader'
      ]
      
      // If it looks like Substack, try collecting from feed first
      if (substackIndicators.some(indicator => html.includes(indicator))) {
        try {
          const feedArticles = await this.collectFromRSSFeed(baseUrl + '/feed')
          if (feedArticles.length > 0) {
            return feedArticles
          }
        } catch (error) {
          console.log(`⚠️ Main page RSS feed failed: ${error}`)
        }
      }
      
      // Try extracting articles directly from main page
      const extractionPatterns = [
        // Newsletter post links
        /<a[^>]*href="([^"]*\/p\/[^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
        /<h[1-6][^>]*>\s*<a[^>]*href="([^"]*\/p\/[^"]*)"[^>]*>([^<]+)<\/a>\s*<\/h[1-6]>/gi,
        // Generic article links
        /<a[^>]*href="([^"]*(?:\/article\/|\/post\/|\/\d{4}\/)[^"]*)"[^>]*>[\s\S]*?([^<]{20,100})</gi
      ]
      
      for (const pattern of extractionPatterns) {
        let match
        while ((match = pattern.exec(html)) !== null && articles.length < 20) {
          const [, url, title] = match
          
          if (title && url && this.isValidSubstackTitle(title)) {
            const fullUrl = url.startsWith('/') ? baseUrl + url : url
            
            articles.push({
              title: title.trim(),
              url: fullUrl,
              publishedDate: new Date().toISOString(),
              description: `Newsletter post from ${new URL(baseUrl).hostname}`,
              author: new URL(baseUrl).hostname
            })
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Main page collection failed: ${error}`)
    }
    
    return articles
  }
} 