import { CollectionOrchestrator, type HistoricalArticle, type OrchestrationResult } from './agents'

export interface HistoricalCollectorResult extends HistoricalArticle {}

/**
 * @deprecated Use CollectionOrchestrator directly for new code
 * This class exists for backward compatibility
 */
export class HistoricalCollector {
  private static orchestrator = new CollectionOrchestrator()

  /**
   * Collect historical articles using the new agent-based system
   * @param blogUrl The blog URL to collect articles from
   * @returns Array of historical articles
   */
  static async collectHistoricalArticles(blogUrl: string): Promise<HistoricalArticle[]> {
    console.log(`🏛️ HistoricalCollector (Agent-Based): Starting collection for ${blogUrl}`)
    
    try {
      const result: OrchestrationResult = await this.orchestrator.collectHistoricalArticles(blogUrl)
      
      // Log the orchestration results for debugging
      console.log(`🎯 Agent Used: ${result.agentUsed}`)
      console.log(`📊 Articles Found: ${result.articlesFound}`)
      console.log(`✅ Success: ${result.success}`)
      
      if (result.analysisResults) {
        console.log(`📋 Analysis Results:`)
        result.analysisResults.agentsAnalyzed.forEach(agent => {
          console.log(`  - ${agent.name}: ${Math.round(agent.confidence * 100)}% confidence`)
        })
        console.log(`🎯 Selected: ${result.analysisResults.selectedAgent} (${result.analysisResults.selectionReason})`)
      }
      
      // Alert if this platform needs attention for creating a specialized agent
      if (result.needsAttention) {
        console.log(`🚨 ATTENTION NEEDED:`)
        console.log(`   Reason: ${result.needsAttention.reason}`)
        console.log(`   Platform Analysis: ${result.needsAttention.platformAnalysis}`)
        console.log(`   Suggestions:`)
        result.needsAttention.suggestions.forEach(suggestion => {
          console.log(`     - ${suggestion}`)
        })
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log(`⚠️ Errors encountered:`)
        result.errors.forEach(error => console.log(`   - ${error}`))
      }
      
      return result.articles
      
    } catch (error) {
      console.error('❌ HistoricalCollector (Agent-Based) failed:', error)
      return []
    }
  }

  /**
   * Get detailed orchestration results (for debugging and analysis)
   */
  static async collectWithDetails(blogUrl: string): Promise<OrchestrationResult> {
    return await this.orchestrator.collectHistoricalArticles(blogUrl)
  }

  /**
   * Test URL analysis without actually collecting articles
   */
  static async analyzeUrl(blogUrl: string) {
    return await this.orchestrator.testUrlAnalysis(blogUrl)
  }

  /**
   * Get information about available agents
   */
  static getAvailableAgents() {
    return this.orchestrator.getAvailableAgents()
  }
} 