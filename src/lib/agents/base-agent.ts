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
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
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
    const articlePatterns = [
      '/post/', '/blog/', '/article/', '/essays/', '/writing/',
      /\/\d{4}\//, // Year in URL
      /\/[^\/]+\/$/ // Slug pattern
    ]
    
    return articlePatterns.some(pattern => 
      typeof pattern === 'string' ? url.includes(pattern) : pattern.test(url)
    )
  }
} 