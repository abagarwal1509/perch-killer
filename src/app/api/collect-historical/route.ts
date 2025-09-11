import { NextRequest, NextResponse } from 'next/server'
import { CollectionOrchestrator } from '@/lib/agents'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }
    
    console.log(`🏛️ API: Starting agent-based historical collection for ${url}`)
    console.log(`🔍 API Debug: URL received:`, url)
    console.log(`🔍 API Debug: URL type:`, typeof url)
    console.log(`🔍 API Debug: URL length:`, url.length)
    
    // Use the new agent-based collection system
    console.log('🤖 API: Using CollectionOrchestrator with specialized agents...')
    const orchestrator = new CollectionOrchestrator()
    
    const result = await Promise.race([
      orchestrator.collectHistoricalArticles(url),
      new Promise((_, reject) => 
        setTimeout(() => {
          console.error('⏰ Historical collection timed out after 60 seconds')
          reject(new Error('Historical collection timed out after 60 seconds'))
        }, 60000)
      )
    ])
    
    console.log(`📊 API: Agent-based collection completed:`)
    console.log(`   Agent Used: ${result.agentUsed}`)
    console.log(`   Articles Found: ${result.articlesFound}`)
    console.log(`   Success: ${result.success}`)
    console.log(`   Platform: ${result.metadata?.platformDetected || 'Unknown'}`)
    console.log(`   Duration: ${Date.now() - startTime}ms`)
    
    if (result.errors && result.errors.length > 0) {
      console.log(`⚠️ API: Collection had errors:`, result.errors)
    }
    
    return NextResponse.json({
      success: result.success,
      articles: result.articles,
      articlesFound: result.articlesFound,
      agentUsed: result.agentUsed,
      platformDetected: result.metadata?.platformDetected,
      methodsUsed: result.metadata?.methodsUsed,
      errors: result.errors,
      executionTime: Date.now() - startTime
    })
    
  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error(`❌ Historical collection API error after ${executionTime}ms:`, error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false,
        articles: [],
        articlesFound: 0,
        agentUsed: 'None (Error)',
        executionTime
      },
      { status: 500 }
    )
  }
} 