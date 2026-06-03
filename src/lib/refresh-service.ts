import { DatabaseService } from './database'
import { collectArticlesForSource } from './add-source'

export interface RefreshProgress {
  current: number
  total: number
  currentSource: string
  status: 'collecting' | 'processing' | 'complete' | 'error'
  errors: string[]
}

export type RefreshProgressCallback = (progress: RefreshProgress) => void

export class RefreshService {
  private static db = new DatabaseService()

  /**
   * Refresh all sources with progress tracking
   */
  static async refreshAllSources(
    onProgress?: RefreshProgressCallback
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

      const updateProgress = (status: RefreshProgress['status'], currentSource = '', error?: string) => {
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
        updateProgress('collecting', source.name)

        try {
          await this.refreshSource(source)
          updateProgress('processing', source.name)
        } catch (error) {
          const errorMessage = `Failed to refresh ${source.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          updateProgress('error', source.name, errorMessage)
        }
      }

      updateProgress('complete')

      return {
        success: errors.length === 0,
        errors
      }
    } catch (error) {
      const errorMessage = `Failed to refresh sources: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Refresh a single source — collects AND persists new articles (dedupe is
   * handled by the upsert in db.addArticles).
   */
  static async refreshSource(source: { id: number; url: string; name: string }): Promise<void> {
    const { totalArticles, info } = await collectArticlesForSource(source as any, source.url)
    console.log(`✅ Refreshed ${source.name}: ${totalArticles} new articles persisted${info}`)
  }

  /**
   * Get refresh progress for UI updates
   */
  static formatProgress(progress: RefreshProgress): string {
    if (progress.status === 'complete') {
      return `Refreshed ${progress.total} sources`
    }
    
    if (progress.status === 'error') {
      return `Error refreshing sources`
    }

    return `Refreshing ${progress.currentSource} (${progress.current}/${progress.total})`
  }
}
