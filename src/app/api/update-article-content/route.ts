import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const { articleId, content } = await request.json()
    
    if (!articleId || !content) {
      return NextResponse.json(
        { error: 'Article ID and content are required' },
        { status: 400 }
      )
    }

    const db = new DatabaseService()
    
    // Update the article with enhanced content
    await db.updateArticleContent(articleId, content)
    
    console.log(`Updated article ${articleId} with enhanced content (${content.length} chars)`)
    
    return NextResponse.json({
      success: true,
      message: 'Article content updated successfully'
    })

  } catch (error) {
    console.error('Update article content error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to update article content'
      },
      { status: 500 }
    )
  }
} 