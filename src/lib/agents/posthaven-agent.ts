import { XMLParser } from 'fast-xml-parser'
import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class PosthavenAgent extends BaseAgent {
  name = 'Posthaven Agent'
  description = 'Specialized agent for Posthaven blogs (like Sam Altman\'s blog.samaltman.com)'

  async canHandle(url: string): Promise<number> {
    const domain = new URL(url).hostname
    
    if (domain.includes('blog.samaltman.com')) return 0.95
    if (url.includes('posthaven') || domain.endsWith('.posthaven.com')) return 0.8
    if (domain.startsWith('blog.') && !url.includes('ghost') && !url.includes('wordpress')) return 0.4
    
    return 0.1
  }

  async verify(url: string): Promise<boolean> {
    try {
      const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(url)}`))
      if (!response.ok) return false
      
      const html = await response.text()
      return html.includes('posthaven') || html.includes('Follow this Posthaven') || html.includes('Subscribe by Email')
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
      
      // Web page pagination (primary for Posthaven)
      try {
        const webPageArticles = await this.collectFromWebPagePagination(baseUrl, 20)
        if (webPageArticles.length > 0) {
          articles.push(...webPageArticles)
          methodsUsed.push('Web Page Pagination')
        }
      } catch (error) {
        errors.push(`Web Page Pagination: ${error}`)
      }
      
      const uniqueArticles = this.deduplicateAndSort(articles)
      
      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: this.name,
        confidence: 0.9,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          platformDetected: 'Posthaven',
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
      urlPatterns: ['posthaven.com', 'blog.samaltman.com'],
      htmlIndicators: ['posthaven', 'Follow this Posthaven'],
      apiEndpoints: ['/posts.atom', '/posts.rss'],
      confidence: 0.8
    }
  }

  private async collectFromWebPagePagination(baseUrl: string, maxPages: number = 20): Promise<HistoricalArticle[]> {
    const allArticles: HistoricalArticle[] = []
    let consecutiveEmptyPages = 0
    
    for (let page = 1; page <= maxPages && consecutiveEmptyPages < 3; page++) {
      try {
        const pageUrl = page === 1 ? baseUrl : `${baseUrl}/?page=${page}`
        const response = await fetch(this.getAbsoluteUrl(`/api/scrape-content?url=${encodeURIComponent(pageUrl)}`))
        
        if (!response.ok) {
          consecutiveEmptyPages++
          continue
        }
        
        const html = await response.text()
        const pageArticles = this.extractArticlesFromHTML(html, baseUrl)
        
        if (pageArticles.length === 0) {
          consecutiveEmptyPages++
        } else {
          consecutiveEmptyPages = 0
          allArticles.push(...pageArticles)
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)) // Rate limiting
      } catch {
        consecutiveEmptyPages++
      }
    }
    
    return allArticles
  }

  private extractArticlesFromHTML(html: string, baseUrl: string): HistoricalArticle[] {
    const articles: HistoricalArticle[] = []
    
    try {
      console.log(`📄 PosthavenAgent: Extracting articles from HTML (${html.length} chars)`)
      
      const cleanHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      
      // Posthaven-specific structure: <article class="post">
      const articleContainers = cleanHtml.match(/<article[^>]*class="[^"]*post[^"]*"[^>]*>[\s\S]*?<\/article>/gi)
      
      if (!articleContainers) {
        console.log(`⚠️ PosthavenAgent: No article containers found`)
        return articles
      }
      
      console.log(`📄 PosthavenAgent: Found ${articleContainers.length} article containers`)
      
      for (const container of articleContainers) {
        try {
          // Extract title and URL from: <h2><a href="url">title</a></h2>
          const titleUrlMatch = container.match(/<h2><a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a><\/h2>/i)
          
          if (!titleUrlMatch) {
            console.log(`⚠️ PosthavenAgent: No title/URL match in container`)
            continue
          }
          
          const [, url, title] = titleUrlMatch
          
          if (!title || !url) {
            console.log(`⚠️ PosthavenAgent: Missing title or URL`)
            continue
          }
          
          // Make URL absolute
          let fullUrl = url.startsWith('/') ? baseUrl + url : url
          
          // Clean title
          const cleanTitle = title
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim()
          
          // Extract description from post body
          const bodyMatch = container.match(/<div[^>]*class="[^"]*posthaven-post-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
          let description = ''
          if (bodyMatch) {
            description = bodyMatch[1]
              .replace(/<[^>]+>/g, ' ')
              .replace(/&[^;]+;/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 200)
          }
          
          // Extract date from footer
          const dateMatch = container.match(/data-unix-time="(\d+)"/i)
          let publishedDate = new Date().toISOString()
          if (dateMatch) {
            const unixTime = parseInt(dateMatch[1])
            publishedDate = new Date(unixTime * 1000).toISOString()
          }
          
          articles.push({
            title: cleanTitle,
            url: fullUrl,
            publishedDate,
            description,
            author: new URL(baseUrl).hostname
          })
          
          console.log(`✅ PosthavenAgent: Extracted "${cleanTitle}"`)
          
        } catch (itemError) {
          console.log(`⚠️ PosthavenAgent: Error processing article container: ${itemError}`)
        }
      }
      
      console.log(`📄 PosthavenAgent: Successfully extracted ${articles.length} articles`)
      
    } catch (error) {
      console.log(`❌ PosthavenAgent: HTML extraction error: ${error}`)
    }
    
    return articles
  }

} 