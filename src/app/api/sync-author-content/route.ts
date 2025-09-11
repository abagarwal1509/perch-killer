import { NextRequest, NextResponse } from 'next/server'
import { CollectionOrchestrator } from '@/lib/agents'
import { DatabaseService } from '@/lib/database'
import { createClient } from '@supabase/supabase-js'

interface SyncResult {
  success: boolean
  authorName: string
  articlesFound: number
  articlesLinked: number
  newArticles: number
  agentUsed: string
  errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { authorSlug } = await request.json()

    if (!authorSlug) {
      return NextResponse.json(
        { error: 'Author slug is required' },
        { status: 400 }
      )
    }

    const db = new DatabaseService()
    
    // Get author information from our API endpoint (which works)
    const authorsResponse = await fetch('http://localhost:3000/api/authors')
    const authors = await authorsResponse.json()
    const author = authors.find((a: any) => a.slug === authorSlug)

    if (!author) {
      return NextResponse.json(
        { error: `Author not found: ${authorSlug}` },
        { status: 404 }
      )
    }

    if (!author.primary_source_url) {
      return NextResponse.json(
        { error: `No primary source URL configured for ${author.name}` },
        { status: 400 }
      )
    }

    console.log(`🔄 Syncing content for ${author.name} from ${author.primary_source_url}`)

    // Use our existing agent system to collect articles
    const orchestrator = new CollectionOrchestrator()
    const collectionResult = await orchestrator.collectHistoricalArticles(author.primary_source_url)

    if (!collectionResult.success) {
      return NextResponse.json({
        success: false,
        error: `Content collection failed: ${collectionResult.errors?.join(', ') || 'Unknown error'}`,
        authorName: author.name,
        articlesFound: 0,
        articlesLinked: 0,
        newArticles: 0,
        agentUsed: collectionResult.agentUsed || 'Unknown',
        errors: collectionResult.errors || []
      })
    }

    console.log(`📚 Agent system found ${collectionResult.articlesFound} articles using ${collectionResult.agentUsed}`)

    // Create a demo user session for this operation
    const demoUserId = '00000000-0000-0000-0000-000000000000' // Demo user ID
    
    // Get or create a source for this author (bypass auth for demo)
    const { data: sources } = await db.supabase
      .from('sources')
      .select('*')
      .eq('author_id', author.id)
    
    let authorSource = sources?.[0]

    if (!authorSource) {
      console.log(`📝 Creating source for ${author.name}`)
      const { data: newSource, error: sourceError } = await db.supabase
        .from('sources')
        .insert({
          name: `${author.name}'s Blog`,
          url: author.primary_source_url,
          description: `Official blog and writings by ${author.name}`,
          status: 'active',
          articles_count: 0,
          author_id: author.id,
          user_id: demoUserId
        })
        .select()
        .single()
      
      if (sourceError) {
        throw new Error(`Failed to create source: ${sourceError.message}`)
      }
      authorSource = newSource
    }

    // Process and link articles to the author
    let articlesLinked = 0
    let newArticles = 0
    const errors: string[] = []

    for (const collectedArticle of collectionResult.articles) {
      try {
        // Check if article already exists (bypass auth for demo)
        const { data: existingArticles } = await db.supabase
          .from('articles')
          .select('*')
          .eq('url', collectedArticle.url)
        
        const existingArticle = existingArticles?.[0]

        if (existingArticle) {
          // Link existing article to author if not already linked
          if (!existingArticle.author_id) {
            await db.supabase
              .from('articles')
              .update({
                author_id: author.id,
                is_enhanced: true,
                content_length: ((collectedArticle as any).content || '').length
              })
              .eq('id', existingArticle.id)
            
            articlesLinked++
            console.log(`🔗 Linked existing article: ${collectedArticle.title}`)
          }
        } else {
          // Add new article (bypass auth for demo)
          const readTime = estimateReadTime((collectedArticle as any).content || collectedArticle.description || '')
          
          const { error: insertError } = await db.supabase
            .from('articles')
            .insert({
              source_id: authorSource.id,
              author_id: author.id,
              title: collectedArticle.title,
              description: collectedArticle.description,
              content: (collectedArticle as any).content,
              url: collectedArticle.url,
              author: collectedArticle.author,
              published_at: collectedArticle.publishedDate,
              image_url: (collectedArticle as any).imageUrl,
              categories: [],
              read_time: readTime,
              is_read: false,
              is_bookmarked: false,
              is_enhanced: !!(collectedArticle as any).content,
              content_length: ((collectedArticle as any).content || '').length,
              ai_analysis: {},
              key_quotes: [],
              main_themes: [],
              contradicts_previous: false,
              related_article_ids: [],
              user_id: demoUserId
            })
          
          if (insertError) {
            throw new Error(insertError.message)
          }
          
          newArticles++
          console.log(`✨ Added new article: ${collectedArticle.title}`)
        }
      } catch (error) {
        const errorMsg = `Failed to process article "${collectedArticle.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    // Update author's last analyzed timestamp (bypass auth for demo)
    await db.supabase
      .from('authors')
      .update({
        last_analyzed_at: new Date().toISOString()
      })
      .eq('id', author.id)

    const result: SyncResult = {
      success: true,
      authorName: author.name,
      articlesFound: collectionResult.articlesFound,
      articlesLinked,
      newArticles,
      agentUsed: collectionResult.agentUsed || 'Unknown',
      errors
    }

    console.log(`✅ Sync complete for ${author.name}:`)
    console.log(`   Articles found: ${result.articlesFound}`)
    console.log(`   New articles: ${result.newArticles}`)
    console.log(`   Articles linked: ${result.articlesLinked}`)
    console.log(`   Agent used: ${result.agentUsed}`)

    return NextResponse.json(result)

  } catch (error) {
    console.error('Author content sync error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}

function estimateReadTime(content: string): string {
  const wordsPerMinute = 200
  const words = content.split(/\s+/).length
  const minutes = Math.max(1, Math.round(words / wordsPerMinute))
  return `${minutes} min read`
} 