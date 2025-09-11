import { NextRequest, NextResponse } from 'next/server'
import { CollectionOrchestrator } from '@/lib/agents'

export async function POST(request: NextRequest) {
  const logs: string[] = []
  
  // Capture console logs
  const originalLog = console.log
  console.log = (...args) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
    logs.push(message)
    originalLog(...args)
  }
  
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    console.log(`\n🧪 TESTING AGENT-BASED COLLECTION FOR: ${url}`)
    console.log('=' .repeat(60))
    
    const startTime = Date.now()
    const orchestrator = new CollectionOrchestrator()
    
    // Step 1: Analyze URL with all agents (without collecting)
    console.log(`🔍 Step 1: Analyzing URL with all agents...`)
    const analysis = await orchestrator.testUrlAnalysis(url)
    
    console.log(`📊 Agent Analysis Results:`)
    analysis.analysisResults.forEach(result => {
      console.log(`   ${result.name}: ${Math.round(result.confidence * 100)}% confidence (${result.canHandle ? 'can handle' : 'cannot handle'})`)
    })
    
    console.log(`🎯 Recommendation: ${analysis.recommendation.agent} - ${analysis.recommendation.reason}`)
    if (analysis.recommendation.shouldCreateSpecializedAgent) {
      console.log(`💡 Suggestion: Consider creating a specialized agent for this platform`)
    }
    
    // Step 2: Execute collection with orchestrator
    console.log(`\n🏛️ Step 2: Executing collection...`)
    const result = await orchestrator.collectHistoricalArticles(url)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // Prepare enhanced result with agent system information
    const enhancedResult = {
      url,
      success: result.success,
      
      // Agent System Information
      agentUsed: result.agentUsed,
      platformDetected: result.metadata?.platformDetected || 'Unknown',
      methodsUsed: result.metadata?.methodsUsed || [],
      
      // Analysis Details
      agentAnalysis: analysis.analysisResults,
      selectionReason: result.analysisResults?.selectionReason || 'Not available',
      
      // Collection Results
      articleCount: result.articlesFound,
      articles: result.articles,
      sampleArticles: result.articles.slice(0, 5).map(article => ({
        title: article.title,
        url: article.url,
        publishedDate: article.publishedDate,
        author: article.author,
        description: article.description?.substring(0, 100) + '...' || 'No description'
      })),
      
      // Performance & Debugging
      duration,
      confidence: result.confidence,
      errors: result.errors || [],
      
      // Attention Flags
      needsAttention: result.needsAttention,
      
      // Raw logs
      logs: logs
    }
    
    console.log(`\n✅ COLLECTION COMPLETE:`)
    console.log(`   Agent Used: ${enhancedResult.agentUsed}`)
    console.log(`   Platform: ${enhancedResult.platformDetected}`)
    console.log(`   Articles Found: ${enhancedResult.articleCount}`)
    console.log(`   Duration: ${enhancedResult.duration}ms`)
    console.log(`   Success: ${enhancedResult.success}`)
    
    if (enhancedResult.needsAttention) {
      console.log(`\n🚨 ATTENTION NEEDED:`)
      console.log(`   ${enhancedResult.needsAttention.reason}`)
      console.log(`   Platform Analysis: ${enhancedResult.needsAttention.platformAnalysis}`)
    }
    
    console.log('=' .repeat(60))
    
    // Restore original console.log
    console.log = originalLog
    
    return NextResponse.json(enhancedResult)
    
  } catch (error) {
    console.error('❌ Agent-Based Test API Error:', error)
    
    // Restore original console.log
    console.log = originalLog
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      logs: logs
    }, { status: 500 })
  }
} 