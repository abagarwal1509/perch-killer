import { DatabaseService } from './database'
import { createCollectionOrchestrator } from './agents'

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
          await this.refreshSource(source.url, source.name)
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
   * Refresh a single source
   */
  static async refreshSource(url: string, sourceName: string): Promise<void> {
    const orchestrator = createCollectionOrchestrator()
    
    // Collect historical articles for this source
    const result = await orchestrator.collectHistoricalArticles(url)
    
    if (!result.success) {
      const errorMessage = result.errors && result.errors.length > 0 
        ? result.errors.join(', ') 
        : 'Failed to collect articles'
      throw new Error(errorMessage)
    }

    console.log(`✅ Refreshed ${sourceName}: ${result.articles?.length || 0} articles processed`)
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
