import { DatabaseService } from './database'
import { RSSParser } from './rss-parser'

export interface QuickRefreshProgress {
  current: number
  total: number
  currentSource: string
  status: 'fetching' | 'processing' | 'complete' | 'error'
  errors: string[]
}

export type QuickRefreshProgressCallback = (progress: QuickRefreshProgress) => void

export class QuickRefreshService {
  private static db = new DatabaseService()

  /**
   * Quick refresh all sources - only fetches latest RSS articles (fast)
   */
  static async quickRefreshAllSources(
    onProgress?: QuickRefreshProgressCallback
  ): Promise<{ success: boolean; errors: string[] }> {
    try {
      // Get all sources
      const sources = await this.db.getSources()
      const errors: string[] = []

      if (sources.length === 0) {
        return { success: true, errors: [] }
      }

      // Initialize progress
      const totalSources = sources.length
      let currentIndex = 0

      const updateProgress = (status: QuickRefreshProgress['status'], currentSource = '', error?: string) => {
        if (error) errors.push(error)
        
        onProgress?.({
          current: currentIndex,
          total: totalSources,
          currentSource,
          status,
          errors: [...errors]
        })
      }

      // Process each source
      for (const source of sources) {
        currentIndex++
        updateProgress('fetching', source.name)

        try {
          await this.quickRefreshSource(source.id, source.url, source.name)
          updateProgress('processing', source.name)
        } catch (error) {
          const errorMessage = `Failed to quick refresh ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          updateProgress('error', source.name, errorMessage)
        }
      }

      updateProgress('complete')

      return {
        success: errors.length === 0,
        errors
      }
    } catch (error) {
      const errorMessage = `Failed to quick refresh sources: ${error instanceof Error ? error.message : 'Unknown error'}`
      onProgress?.({
        current: 0,
        total: 0,
        currentSource: '',
        status: 'error',
        errors: [errorMessage]
      })

      return {
        success: false,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Quick refresh a single source - only gets latest RSS articles (not historical)
   */
  static async quickRefreshSource(sourceId: number, url: string, sourceName: string): Promise<number> {
    console.log(`⚡ Quick refreshing ${sourceName}...`)
    
    try {
      // Parse RSS feed to get latest articles
      const parsedFeed = await RSSParser.fetchAndParse(url)
      const rssResult = {
        success: true,
        articles: parsedFeed.items
      }
      
      if (!rssResult.success || !rssResult.articles || rssResult.articles.length === 0) {
        throw new Error('No articles found in RSS feed')
      }

      // Convert RSS articles to database format
      const articles = rssResult.articles.map((article: any) => ({
        source_id: sourceId,
        title: article.title || 'Untitled',
        description: article.description || article.summary || 'No description available',
        content: article.content || article.description,
        url: article.link || article.url,
        author: article.author || sourceName,
        published_at: article.pubDate ? new Date(article.pubDate).toISOString() : new Date().toISOString(),
        image_url: article.image || null,
        categories: article.categories || [],
        read_time: this.estimateReadTime(article.content || article.description || ''),
        is_read: false,
        is_bookmarked: false,
        is_enhanced: false,
        content_length: (article.content || article.description || '').length,
        ai_analysis: {},
        key_quotes: [],
        main_themes: [],
        contradicts_previous: false,
        related_article_ids: []
      }))

      // Add articles to database (duplicates will be ignored)
      const storedArticles = await this.db.addArticles(articles)

      // Update source last_fetched_at
      await this.db.updateSource(sourceId, {
        last_fetched_at: new Date().toISOString(),
        status: 'active'
      })

      console.log(`✅ Quick refresh ${sourceName}: ${storedArticles.length} new articles added`)
      return storedArticles.length

    } catch (error) {
      console.error(`❌ Quick refresh failed for ${sourceName}:`, error)
      
      // Update source status to error
      await this.db.updateSource(sourceId, {
        status: 'error',
        last_fetched_at: new Date().toISOString()
      })
      
      throw error
    }
  }

  /**
   * Estimate reading time for content
   */
  private static estimateReadTime(content: string): string {
    const wordsPerMinute = 200
    const words = content.trim().split(/\s+/).length
    const minutes = Math.ceil(words / wordsPerMinute)
    return `${minutes} min read`
  }

  /**
   * Format progress for UI display
   */
  static formatProgress(progress: QuickRefreshProgress): string {
    if (progress.status === 'complete') {
      return `Quick refreshed ${progress.total} sources`
    }
    
    if (progress.status === 'error') {
      return `Error during quick refresh`
    }

    return `Quick refreshing ${progress.currentSource} (${progress.current}/${progress.total})`
  }
}
