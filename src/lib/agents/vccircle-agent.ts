import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class VCCircleAgent extends BaseAgent {
  name = 'VCCircle Agent'
  description = 'Specialized agent for VCCircle financial news website'

  async canHandle(url: string): Promise<number> {
    const domain = new URL(url).hostname
    
    // High confidence for VCCircle domain
    if (domain === 'www.vccircle.com' || domain === 'vccircle.com') {
      return 0.95
    }
    
    // Check for VCCircle-related patterns
    if (url.includes('vccircle')) {
      return 0.8
    }
    
    return 0.0
  }

  async verify(url: string): Promise<boolean> {
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
      if (!response.ok) return false
      
      // The scrape-content API returns raw HTML content, not JSON
      const content = await response.text()
      
      // Look for VCCircle-specific indicators in the HTML content
      const vccircleIndicators = [
        'vccircle',
        'VCCircle',
        'venture capital',
        'private equity',
        'startup funding',
        'financial news',
        'Team VCC',
        'PRO Exclusives',
        'NewsMediaOrganization', // From structured data
        'vccircle.com',
        'VENTURE CAPITAL',
        'PRIVATE EQUITY'
      ]
      
      const foundIndicators = vccircleIndicators.filter(indicator => 
        content.toLowerCase().includes(indicator.toLowerCase())
      )
      
      console.log(`🔍 VCCircle verification: Found ${foundIndicators.length} indicators: ${foundIndicators.join(', ')}`)
      
      // Return true if we find at least 2 indicators
      return foundIndicators.length >= 2
    } catch (error) {
      console.error('VCCircle verification error:', error)
      return false
    }
  }

  async collect(url: string): Promise<AgentResult> {
    const startTime = Date.now()
    const articles: HistoricalArticle[] = []
    const errors: string[] = []
    const methodsUsed: string[] = []
    
    try {
      console.log(`📰 VCCircle Agent: Starting collection for ${url}`)
      
      // Method 1: Try to scrape the main page and extract article links
      console.log('🔍 VCCircle Agent: Scraping main page for article links...')
      try {
        const mainPageArticles = await this.scrapeMainPageArticles(url)
        if (mainPageArticles.length > 0) {
          articles.push(...mainPageArticles)
          methodsUsed.push('Main Page Scraping')
          console.log(`✅ VCCircle Agent: Found ${mainPageArticles.length} articles from main page`)
        }
      } catch (error) {
        errors.push(`Main page scraping: ${error}`)
      }

      // Method 2: Try archive and historical content pages
      console.log('🏛️ VCCircle Agent: Trying archive and historical content pages...')
      const archiveUrls = [
        'archive',
        'all',
        'articles', 
        'content',
        'posts',
        'blog',
        'latest',
        'news',
        'all-stories',
        'all-news',
        'archives'
      ]

      for (const archivePath of archiveUrls) {
        try {
          const archiveUrl = `${url.replace(/\/$/, '')}/${archivePath}`
          const archiveArticles = await this.scrapeCategoryPage(archiveUrl)
          if (archiveArticles.length > 0) {
            articles.push(...archiveArticles)
            methodsUsed.push(`Archive: ${archivePath}`)
            console.log(`✅ VCCircle Agent: Found ${archiveArticles.length} articles from archive: ${archivePath}`)
          }
        } catch (error) {
          errors.push(`Archive ${archivePath}: ${error}`)
        }
      }

      // Method 3: Try category pages
      console.log('📂 VCCircle Agent: Trying category pages...')
      const categories = [
        'venture-capital',
        'private-equity',
        'ma', // M&A
        'startups',
        'finance',
        'consumer',
        'healthcare',
        'infrastructure',
        'tmt' // Technology, Media & Telecom
      ]

      for (const category of categories) {
        try {
          const categoryUrl = `${url.replace(/\/$/, '')}/${category}`
          const categoryArticles = await this.scrapeCategoryPage(categoryUrl)
          if (categoryArticles.length > 0) {
            articles.push(...categoryArticles)
            methodsUsed.push(`Category: ${category}`)
            console.log(`✅ VCCircle Agent: Found ${categoryArticles.length} articles from ${category}`)
          }
        } catch (error) {
          errors.push(`Category ${category}: ${error}`)
        }
      }

      // Method 4: Try date-based and year-based archives
      console.log('📅 VCCircle Agent: Trying date-based archives...')
      const currentYear = new Date().getFullYear()
      const dateArchiveUrls = [
        '2024', '2023', '2022', '2021', '2020', '2019', '2018',
        `${currentYear}`, `${currentYear-1}`, `${currentYear-2}`,
        'archive/2024', 'archive/2023', 'archive/2022',
        'news/2024', 'news/2023', 'news/2022'
      ]

      for (const dateArchive of dateArchiveUrls) {
        try {
          const dateUrl = `${url.replace(/\/$/, '')}/${dateArchive}`
          const dateArticles = await this.scrapeCategoryPage(dateUrl)
          if (dateArticles.length > 0) {
            articles.push(...dateArticles)
            methodsUsed.push(`Date archive: ${dateArchive}`)
            console.log(`✅ VCCircle Agent: Found ${dateArticles.length} articles from date archive: ${dateArchive}`)
          }
        } catch (error) {
          errors.push(`Date archive ${dateArchive}: ${error}`)
        }
      }

      // Method 5: Try deeper pagination on successful category pages for historical collection
      if (articles.length > 5) { // Only try pagination if we found some articles
        console.log('📄 VCCircle Agent: Trying deeper pagination on successful pages...')
        
        // Try deeper pagination on categories that worked
        for (const category of categories) {
          for (let page = 2; page <= 15; page++) { // Try pages 2-15 for deeper historical search
            try {
              const paginatedUrl = `${url.replace(/\/$/, '')}/${category}/page/${page}`
              const paginatedArticles = await this.scrapeCategoryPage(paginatedUrl)
              if (paginatedArticles.length > 0) {
                articles.push(...paginatedArticles)
                methodsUsed.push(`${category} page ${page}`)
                console.log(`✅ VCCircle Agent: Found ${paginatedArticles.length} articles from ${category} page ${page}`)
              } else {
                console.log(`❌ VCCircle Agent: No articles found on ${category} page ${page}, stopping pagination for this category`)
                break // No more articles on this category, stop pagination
              }
            } catch (error) {
              // Silent fail for pagination - it's expected that some pages won't exist
              console.log(`❌ VCCircle Agent: Pagination failed for ${category} page ${page}`)
              break
            }
          }
        }
      }

      // Remove duplicates based on URL
      const uniqueArticles = articles.filter((article, index, self) => 
        index === self.findIndex(a => a.url === article.url)
      )

      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: `VCCircle specialized scraping with ${methodsUsed.length} methods`,
        confidence: 0.9,
        errors,
        metadata: {
          platformDetected: 'VCCircle Financial News',
          methodsUsed,
          totalTime: Date.now() - startTime
        }
      }
    } catch (error) {
      return {
        success: false,
        articles: [],
        articlesFound: 0,
        strategy: 'VCCircle scraping failed',
        confidence: 0.9,
        errors: [...errors, `Collection failed: ${error}`],
        metadata: {
          platformDetected: 'VCCircle Financial News',
          methodsUsed,
          totalTime: Date.now() - startTime
        }
      }
    }
  }

  private async scrapeMainPageArticles(url: string): Promise<HistoricalArticle[]> {
    const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    // The scrape-content API returns raw HTML content, not JSON
    const content = await response.text()
    
    return this.extractArticlesFromHTML(content, url)
  }

  private async scrapeCategoryPage(categoryUrl: string): Promise<HistoricalArticle[]> {
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(categoryUrl)}`))
      if (!response.ok) return []
      
      // The scrape-content API returns raw HTML content, not JSON
      const content = await response.text()
      
      return this.extractArticlesFromHTML(content, categoryUrl)
    } catch {
      return []
    }
  }

  private extractArticlesFromHTML(html: string, baseUrl: string): HistoricalArticle[] {
    const articles: HistoricalArticle[] = []
    
    try {
      // Method 1: Extract from Next.js __NEXT_DATA__ (VCCircle's primary data source)
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1])
          
          // Extract from latest_articles in pageProps
          if (nextData?.props?.pageProps?.data?.latest_articles) {
            const latestArticles = nextData.props.pageProps.data.latest_articles
            console.log(`🔍 VCCircle Agent: Found ${latestArticles.length} articles in __NEXT_DATA__`)
            
            for (const articleData of latestArticles) {
              if (articleData.title && articleData.slug) {
                const article: HistoricalArticle = {
                  title: this.cleanText(articleData.title),
                  url: `https://www.vccircle.com/${articleData.slug}`,
                  publishedDate: articleData.publish ? new Date(articleData.publish).toISOString() : new Date().toISOString(),
                  description: this.cleanText(articleData.summary || `${articleData.title} - VCCircle Financial News`),
                  author: 'VCCircle Team'
                }
                articles.push(article)
              }
            }
          }
        } catch (error) {
          console.warn('Failed to parse __NEXT_DATA__:', error)
        }
      }
      
      // Method 2: Extract from JSON-LD structured data (fallback)
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
      
      for (const jsonLdMatch of jsonLdMatches) {
        const jsonContent = jsonLdMatch.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '')
        try {
          const data = JSON.parse(jsonContent)
          if (data['@type'] === 'ItemList' && data.itemListElement) {
            for (const item of data.itemListElement) {
              if (item['@type'] === 'ListItem' && item.url && item.name) {
                const article: HistoricalArticle = {
                  title: this.cleanText(item.name),
                  url: item.url.startsWith('http') ? item.url : `https://www.vccircle.com${item.url}`,
                  publishedDate: new Date().toISOString(), // VCCircle doesn't provide dates in structured data
                  description: this.cleanText(item.description || `Article from VCCircle: ${item.name}`),
                  author: 'VCCircle Team'
                }
                articles.push(article)
              }
            }
          }
        } catch (error) {
          console.warn('Failed to parse JSON-LD:', error)
        }
      }
      
      // Method 2: Extract article patterns from HTML if JSON-LD didn't work
      if (articles.length === 0) {
        // Look for article blocks
        const articleBlocks = html.match(/<article[^>]*>.*?<\/article>/gi) || []
        
        for (const block of articleBlocks) {
          const article = this.parseArticleBlock(block, baseUrl)
          if (article) {
            articles.push(article)
          }
        }
        
        // Method 3: Fallback - extract from link patterns
        if (articles.length === 0) {
          const linkMatches = html.match(/<a[^>]*href=["']([^"']*)[^>]*>([^<]*)<\/a>/gi) || []
          
          for (const link of linkMatches.slice(0, 20)) { // Limit to first 20 links
            const article = this.parseArticleLink(link, baseUrl)
            if (article && this.isValidArticleUrl(article.url)) {
              articles.push(article)
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error extracting articles from HTML:', error)
    }
    
    return articles
  }

  private parseArticleBlock(block: string, baseUrl: string): HistoricalArticle | null {
    try {
      // Extract title
      const titleMatch = block.match(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/i)
      const title = titleMatch ? titleMatch[1].trim() : ''
      
      // Extract URL
      const urlMatch = block.match(/href=["']([^"']*)/i)
      const relativeUrl = urlMatch ? urlMatch[1] : ''
      const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://www.vccircle.com${relativeUrl}`
      
      // Extract description/excerpt
      const descMatch = block.match(/<p[^>]*>([^<]*)<\/p>/i)
      const description = descMatch ? descMatch[1].trim() : ''
      
      // Extract date
      const dateMatch = block.match(/\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i)
      const publishedDate = dateMatch ? this.parseDate(dateMatch[0]) : new Date().toISOString()
      
      // Extract author
      const authorMatch = block.match(/by\s+([A-Za-z\s]+)/i)
      const author = authorMatch ? authorMatch[1].trim() : 'VCCircle Team'
      
      if (title && fullUrl && !fullUrl.includes('#')) {
        return {
          title: this.cleanText(title),
          url: fullUrl,
          publishedDate,
          description: this.cleanText(description),
          author
        }
      }
    } catch (error) {
      console.error('Error parsing article block:', error)
    }
    
    return null
  }

  private parseArticleLink(linkHtml: string, baseUrl: string): HistoricalArticle | null {
    try {
      const urlMatch = linkHtml.match(/href=["']([^"']*)/i)
      const titleMatch = linkHtml.match(/>([^<]*)</i)
      
      const relativeUrl = urlMatch ? urlMatch[1] : ''
      const title = titleMatch ? titleMatch[1].trim() : ''
      
      if (title && relativeUrl && !relativeUrl.includes('#') && title.length > 10) {
        const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://www.vccircle.com${relativeUrl}`
        
        return {
          title: this.cleanText(title),
          url: fullUrl,
          publishedDate: new Date().toISOString(),
          description: `Article from VCCircle: ${this.cleanText(title)}`,
          author: 'VCCircle Team'
        }
      }
    } catch (error) {
      console.error('Error parsing article link:', error)
    }
    
    return null
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
  }

  private isValidArticleUrl(url: string): boolean {
    // Filter out non-article URLs
    const invalidPatterns = [
      '/pro/',
      '/events',
      '/subscription',
      '/about',
      '/contact',
      '/privacy',
      '/terms',
      'javascript:',
      'mailto:',
      'tel:',
      '#',
      '/search',
      '/tag/',
      '/category/'
    ]
    
    return !invalidPatterns.some(pattern => url.includes(pattern)) && 
           url.includes('vccircle.com') &&
           url.length > 30 // Reasonable article URL length
  }

  getPlatformIndicators(): PlatformIndicators {
    return {
      urlPatterns: ['vccircle.com'],
      htmlIndicators: [
        'VCCircle',
        'venture capital',
        'private equity',
        'Team VCC',
        'PRO Exclusives',
        'LP Corner',
        'Startups'
      ],
      apiEndpoints: [],
      confidence: 0.95
    }
  }
}
