import { XMLParser } from 'fast-xml-parser'
import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class MediumAgent extends BaseAgent {
  name = 'Medium Agent'
  description = 'Specialized agent for Medium publications and personal blogs'

  async canHandle(url: string): Promise<number> {
    const domain = new URL(url).hostname
    
    if (domain === 'medium.com' || domain.endsWith('.medium.com')) return 0.95
    if (url.includes('medium.com')) return 0.9
    if (url.includes('@') && domain === 'medium.com') return 0.9 // Medium user profile
    
    return 0.1
  }

  async verify(url: string): Promise<boolean> {
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
      if (!response.ok) return false
      
      const html = await response.text()
      
      const mediumIndicators = [
        'medium.com', 'Medium', 'medium-com',
        'cdn-cgi/image/medium.com', '__APOLLO_STATE__',
        'medium-article', 'medium-writer'
      ]
      
      return mediumIndicators.some(indicator => html.includes(indicator))
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
      const parsedUrl = new URL(url)
      
      // Method 1: Medium RSS feed
      try {
        let rssUrl: string
        
        // Handle different Medium URL patterns
        if (parsedUrl.pathname.startsWith('/@')) {
          // User profile: medium.com/@username
          rssUrl = `${parsedUrl.origin}/feed${parsedUrl.pathname}`
        } else if (parsedUrl.hostname !== 'medium.com') {
          // Custom domain publication: publication.com
          rssUrl = `${parsedUrl.origin}/feed`
        } else {
          // Publication on Medium: medium.com/publication
          rssUrl = `${parsedUrl.origin}/feed${parsedUrl.pathname}`
        }
        
        const rssArticles = await this.collectFromRSSFeed(rssUrl)
        if (rssArticles.length > 0) {
          articles.push(...rssArticles)
          methodsUsed.push(`Medium RSS: ${rssUrl}`)
        }
      } catch (error) {
        errors.push(`Medium RSS: ${error}`)
      }
      
      // Method 2: Archive/Latest page scraping
      try {
        const archiveUrl = url.endsWith('/') ? `${url}archive` : `${url}/archive`
        const archiveArticles = await this.collectFromArchivePage(archiveUrl)
        if (archiveArticles.length > 0) {
          articles.push(...archiveArticles)
          methodsUsed.push('Archive Page')
        }
      } catch (error) {
        errors.push(`Archive: ${error}`)
      }
      
      const uniqueArticles = this.deduplicateAndSort(articles)
      
      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: this.name,
        confidence: 0.9,
        metadata: {
          platformDetected: 'Medium',
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
      urlPatterns: ['medium.com', '.medium.com'],
      htmlIndicators: ['medium.com', '__APOLLO_STATE__', 'medium-article'],
      apiEndpoints: ['/feed', '/archive'],
      confidence: 0.9
    }
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
          const link = item.link?.['#text'] || item.link || item.guid?.['#text'] || item.guid
          const pubDate = item.pubDate
          const description = item.description?.['#text'] || item.description
          const creator = item['dc:creator'] || item.author
          
          if (title && link) {
            articles.push({
              title: typeof title === 'string' ? title.trim() : String(title).trim(),
              url: typeof link === 'string' ? link.trim() : String(link).trim(),
              publishedDate: pubDate ? this.parseDate(String(pubDate)) : new Date().toISOString(),
              description: description ? String(description).replace(/<[^>]+>/g, '').substring(0, 200) : '',
              author: creator ? String(creator) : this.extractMediumUsername(rssUrl)
            })
          }
        } catch {
          // Skip invalid items
        }
      }
    } catch (error) {
      throw new Error(`Medium RSS collection failed: ${error}`)
    }
    
    return articles
  }

  private async collectFromArchivePage(archiveUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(archiveUrl)}`))
      
      if (!response.ok) throw new Error(`Archive page fetch failed: ${response.status}`)
      
      const html = await response.text()
      const baseUrl = new URL(archiveUrl).origin
      
      // Medium archive page patterns
      const cleanHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      
      // Look for Medium article links
      const articlePattern = /<a[^>]*href="([^"]*medium\.com[^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi
      let match
      
      while ((match = articlePattern.exec(cleanHtml)) !== null) {
        const [, url, title] = match
        
        if (title && url && this.looksLikeArticle(url)) {
          articles.push({
            title: title.trim(),
            url: url,
            publishedDate: new Date().toISOString(),
            author: this.extractMediumUsername(url)
          })
        }
      }
      
      // Alternative pattern for Medium's specific HTML structure
      const altPattern = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>/gi
      while ((match = altPattern.exec(cleanHtml)) !== null) {
        const [, title, url] = match
        
        if (title && url && this.looksLikeArticle(url)) {
          let fullUrl = url.startsWith('/') ? baseUrl + url : url
          
          articles.push({
            title: title.trim(),
            url: fullUrl,
            publishedDate: new Date().toISOString(),
            author: this.extractMediumUsername(fullUrl)
          })
        }
      }
    } catch (error) {
      throw new Error(`Medium archive page parsing failed: ${error}`)
    }
    
    return articles
  }

  private extractMediumUsername(url: string): string {
    try {
      const parsedUrl = new URL(url)
      
      // Extract from URL patterns like /@username or medium.com/@username
      const usernameMatch = parsedUrl.pathname.match(/@([^\/]+)/)
      if (usernameMatch) {
        return usernameMatch[1]
      }
      
      // Extract from publication URLs
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean)
      if (pathSegments.length > 0 && !pathSegments[0].startsWith('@')) {
        return pathSegments[0] // Publication name
      }
      
      return parsedUrl.hostname.replace('.medium.com', '').replace('medium.com', 'Medium')
    } catch {
      return 'Medium'
    }
  }
} 