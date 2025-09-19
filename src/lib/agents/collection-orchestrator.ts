import { BaseAgent, AgentResult, HistoricalArticle } from './base-agent'
import { GhostAgent } from './ghost-agent'
import { PosthavenAgent } from './posthaven-agent'
import { WordPressAgent } from './wordpress-agent'
import { SubstackAgent } from './substack-agent'
import { MediumAgent } from './medium-agent'
import { NavalAgent } from './naval-agent'
import { UniversalAgent } from './universal-agent'
import { VCCircleAgent } from './vccircle-agent'

export interface OrchestrationResult extends AgentResult {
  agentUsed: string
  analysisResults?: {
    agentsAnalyzed: Array<{
      name: string
      confidence: number
      canHandle: boolean
    }>
    selectedAgent: string
    selectionReason: string
  }
  needsAttention?: {
    reason: string
    suggestions: string[]
    platformAnalysis: string
  }
}

export class CollectionOrchestrator {
  private agents: BaseAgent[]
  
  constructor() {
    // Register all available agents in priority order
    // Specialized agents first, universal fallback last
    this.agents = [
      new NavalAgent(),        // Very high priority for nav.al
      new PosthavenAgent(),    // High priority for Sam Altman's blog
      new VCCircleAgent(),     // High priority for VCCircle financial news
      new SubstackAgent(),     // High priority for newsletters
      new MediumAgent(),       // High priority for Medium publications
      new WordPressAgent(),    // High priority for WordPress sites
      new GhostAgent(),        // Medium priority for Ghost CMS
      new UniversalAgent()     // Always last as fallback
    ]
  }

  /**
   * Main entry point for historical article collection
   */
  async collectHistoricalArticles(url: string): Promise<OrchestrationResult> {
    console.log(`🎯 Collection Orchestrator: Starting analysis for ${url}`)
    
    try {
      // Step 1: Analyze URL with all agents to get confidence scores
      const analysisResults = await this.analyzeUrl(url)
      
      // Step 2: Select the best agent based on confidence and verification
      const { selectedAgent, reason } = await this.selectBestAgent(url, analysisResults)
      
      if (!selectedAgent) {
        return this.handleUnknownPlatform(url, analysisResults)
      }
      
      // Step 3: Verify the selected agent can actually handle this URL
      console.log(`🔍 Orchestrator: Verifying ${selectedAgent.name} can handle ${url}`)
      const canVerify = await selectedAgent.verify(url)
      
      if (!canVerify && selectedAgent.name !== 'Universal Agent') {
        console.log(`❌ Orchestrator: ${selectedAgent.name} verification failed, falling back to Universal Agent`)
        const universalAgent = this.agents.find(a => a.name === 'Universal Agent')!
        const result = await universalAgent.collect(url)
        
        return {
          ...result,
          agentUsed: `${selectedAgent.name} (failed) → ${universalAgent.name}`,
          analysisResults: {
            agentsAnalyzed: analysisResults,
            selectedAgent: selectedAgent.name,
            selectionReason: `${reason} (but verification failed, used fallback)`
          }
        }
      }
      
      // Step 4: Execute collection with the selected agent
      console.log(`🏛️ Orchestrator: Executing collection with ${selectedAgent.name}`)
      const result = await selectedAgent.collect(url)
      
      // Step 5: Enhance result with orchestration metadata
      return {
        ...result,
        agentUsed: selectedAgent.name,
        analysisResults: {
          agentsAnalyzed: analysisResults,
          selectedAgent: selectedAgent.name,
          selectionReason: reason
        }
      }
      
    } catch (error) {
      console.error('❌ Collection Orchestrator failed:', error)
      
      // Emergency fallback to Universal Agent
      try {
        const universalAgent = this.agents.find(a => a.name === 'Universal Agent')!
        const fallbackResult = await universalAgent.collect(url)
        
        return {
          ...fallbackResult,
          agentUsed: 'Universal Agent (emergency fallback)',
          errors: [`Orchestrator error: ${error}`, ...(fallbackResult.errors || [])]
        }
        
      } catch (fallbackError) {
        return {
          success: false,
          articles: [],
          articlesFound: 0,
          strategy: 'Collection Orchestrator',
          confidence: 0,
          agentUsed: 'None (total failure)',
          errors: [`Orchestrator failed: ${error}`, `Fallback failed: ${fallbackError}`]
        }
      }
    }
  }

  /**
   * Analyze URL with all agents to get confidence scores
   */
  private async analyzeUrl(url: string): Promise<Array<{
    name: string
    confidence: number
    canHandle: boolean
  }>> {
    const results = []
    
    for (const agent of this.agents) {
      try {
        const confidence = await agent.canHandle(url)
        results.push({
          name: agent.name,
          confidence,
          canHandle: confidence > 0.1 // Minimum threshold
        })
        
        console.log(`📊 ${agent.name}: ${Math.round(confidence * 100)}% confidence`)
        
      } catch (error) {
        console.log(`⚠️ ${agent.name} analysis failed:`, error)
        results.push({
          name: agent.name,
          confidence: 0,
          canHandle: false
        })
      }
    }
    
    return results.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Select the best agent based on analysis results
   */
  private async selectBestAgent(url: string, analysisResults: Array<{
    name: string
    confidence: number
    canHandle: boolean
  }>): Promise<{ selectedAgent: BaseAgent | null, reason: string }> {
    
    // Find agents that can handle this URL (confidence > 0.1)
    const capableAgents = analysisResults.filter(result => result.canHandle)
    
    if (capableAgents.length === 0) {
      return { selectedAgent: null, reason: 'No agents can handle this URL' }
    }
    
    // Select the agent with highest confidence
    const bestResult = capableAgents[0]
    const selectedAgent = this.agents.find(agent => agent.name === bestResult.name)!
    
    let reason = `Highest confidence: ${Math.round(bestResult.confidence * 100)}%`
    
    // Add additional context to selection reason
    if (bestResult.confidence > 0.8) {
      reason += ' (high confidence match)'
    } else if (bestResult.confidence > 0.5) {
      reason += ' (medium confidence match)'
    } else if (bestResult.name === 'Universal Agent') {
      reason += ' (fallback agent)'
    } else {
      reason += ' (low confidence, may fallback)'
    }
    
    console.log(`🎯 Orchestrator: Selected ${selectedAgent.name} - ${reason}`)
    
    return { selectedAgent, reason }
  }

  /**
   * Handle unknown platforms that no agent can handle well
   */
  private async handleUnknownPlatform(
    url: string, 
    analysisResults: Array<{ name: string; confidence: number; canHandle: boolean }>
  ): Promise<OrchestrationResult> {
    
    console.log(`🚨 Unknown platform detected: ${url}`)
    
    // Try to analyze what type of platform this might be
    const platformAnalysis = await this.analyzePlatformType(url)
    
    // Fall back to Universal Agent but flag for attention
    const universalAgent = this.agents.find(a => a.name === 'Universal Agent')!
    const result = await universalAgent.collect(url)
    
    return {
      ...result,
      agentUsed: 'Universal Agent (unknown platform)',
      analysisResults: {
        agentsAnalyzed: analysisResults,
        selectedAgent: 'Universal Agent',
        selectionReason: 'No specialized agent available'
      },
      needsAttention: {
        reason: 'Unknown platform type detected',
        suggestions: [
          'Consider creating a specialized agent for this platform',
          'Check if this is a known CMS that needs custom handling',
          'Analyze the platform\'s API documentation for better integration'
        ],
        platformAnalysis
      }
    }
  }

  /**
   * Analyze what type of platform this might be for future agent development
   */
  private async analyzePlatformType(url: string): Promise<string> {
    try {
      const domain = new URL(url).hostname
      
      // Quick heuristic analysis
      const indicators = []
      
      if (domain.includes('wordpress')) indicators.push('WordPress')
      if (domain.includes('medium')) indicators.push('Medium')
      if (domain.includes('substack')) indicators.push('Substack')
      if (domain.includes('ghost')) indicators.push('Ghost')
      if (domain.includes('squarespace')) indicators.push('Squarespace')
      if (domain.includes('wix')) indicators.push('Wix')
      if (domain.includes('notion')) indicators.push('Notion')
      if (domain.startsWith('blog.')) indicators.push('Blog subdomain')
      if (url.includes('/blog/')) indicators.push('Blog path')
      
      if (indicators.length > 0) {
        return `Potential platform indicators: ${indicators.join(', ')}`
      }
      
      return `Custom domain (${domain}) - platform type unknown`
      
    } catch (error) {
      return `Platform analysis failed: ${error}`
    }
  }

  /**
   * Get information about all available agents
   */
  getAvailableAgents(): Array<{
    name: string
    description: string
    indicators: any
  }> {
    return this.agents.map(agent => ({
      name: agent.name,
      description: agent.description,
      indicators: agent.getPlatformIndicators()
    }))
  }

  /**
   * Test URL against all agents without executing collection
   */
  async testUrlAnalysis(url: string): Promise<{
    url: string
    analysisResults: Array<{
      name: string
      confidence: number
      canHandle: boolean
    }>
    recommendation: {
      agent: string
      reason: string
      shouldCreateSpecializedAgent: boolean
    }
  }> {
    const analysisResults = await this.analyzeUrl(url)
    const { selectedAgent, reason } = await this.selectBestAgent(url, analysisResults)
    
    return {
      url,
      analysisResults,
      recommendation: {
        agent: selectedAgent?.name || 'None',
        reason,
        shouldCreateSpecializedAgent: !selectedAgent || selectedAgent.name === 'Universal Agent'
      }
    }
  }
} 