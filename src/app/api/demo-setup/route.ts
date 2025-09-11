import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    // Demo data for Phase 1 showcase - simulating Sam Altman's content
    const demoSources = [
      {
        name: 'Sam Altman\'s Blog',
        url: 'https://blog.samaltman.com/rss',
        description: '🌟 FEATURED AUTHOR: CEO of OpenAI, former YC President. Track his evolving views on AGI, AI safety, and the future of technology. Perfect for VCs and researchers monitoring AI development.',
        status: 'active'
      },
      {
        name: 'Marc Andreessen - a16z',
        url: 'https://a16z.com/author/marc-andreessen/feed/',
        description: '💡 COMING SOON: Co-founder of a16z, influential voice on technology and startups. Evolution tracking will include his positions on AI, crypto, and tech regulation.',
        status: 'active'
      },
      {
        name: 'Paul Graham Essays',
        url: 'http://www.paulgraham.com/rss.html',
        description: '📈 PIPELINE: YC founder, startup philosopher. Track his thinking on entrepreneurship, programming, and technology trends.',
        status: 'active'
      }
    ]

    const demoArticles = [
      {
        title: 'AGI Timelines: My Updated Views',
        description: 'Recent thoughts on when AGI might arrive and what it means for society.',
        url: 'https://blog.samaltman.com/agi-timelines-2024',
        author: 'Sam Altman',
        published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        content: 'Demo content: This represents a hypothetical post where Sam discusses updated AGI timelines...',
        categories: ['AI', 'AGI', 'Future'],
        read_time: '5 min read',
        is_read: false,
        is_bookmarked: false
      },
      {
        title: 'AI Safety: A Personal Reflection',
        description: 'Why I believe careful development is more important than speed.',
        url: 'https://blog.samaltman.com/ai-safety-reflection',
        author: 'Sam Altman',
        published_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks ago
        content: 'Demo content: In this post, Sam reflects on the importance of AI safety measures...',
        categories: ['AI Safety', 'Ethics', 'Policy'],
        read_time: '8 min read',
        is_read: true,
        is_bookmarked: true
      },
      {
        title: 'The Future of Work in an AI World',
        description: 'How artificial intelligence will reshape employment and society.',
        url: 'https://blog.samaltman.com/future-of-work-ai',
        author: 'Sam Altman',
        published_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(), // 3 weeks ago
        content: 'Demo content: Sam explores how AI will transform various industries and job markets...',
        categories: ['AI', 'Future of Work', 'Society'],
        read_time: '12 min read',
        is_read: false,
        is_bookmarked: false
      }
    ]

    // Clear existing demo data
    await supabase.from('articles').delete().like('url', '%blog.samaltman.com%')
    await supabase.from('sources').delete().like('url', '%blog.samaltman.com%')

    let results = {
      sources: [],
      articles: [],
      errors: []
    }

    // Add demo sources
    for (const source of demoSources) {
      try {
        const { data, error } = await supabase
          .from('sources')
          .insert(source)
          .select()
          .single()

        if (error) {
          results.errors.push(`Source "${source.name}": ${error.message}`)
        } else {
          results.sources.push(data)
        }
      } catch (err) {
        results.errors.push(`Source "${source.name}": ${err}`)
      }
    }

    // Add demo articles to Sam Altman's source
    const samSource = results.sources.find(s => s.name.includes('Sam Altman'))
    if (samSource) {
      for (const article of demoArticles) {
        try {
          const { data, error } = await supabase
            .from('articles')
            .insert({
              ...article,
              source_id: samSource.id
            })
            .select()
            .single()

          if (error) {
            results.errors.push(`Article "${article.title}": ${error.message}`)
          } else {
            results.articles.push(data)
          }
        } catch (err) {
          results.errors.push(`Article "${article.title}": ${err}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Demo data setup complete! You can now explore the Phase 1 "Insider\'s Edge" features.',
      data: results,
      note: 'This is demo data showcasing how author tracking will work once the full schema is deployed.'
    })

  } catch (error) {
    console.error('Error setting up demo:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Demo setup failed' 
      },
      { status: 500 }
    )
  }
} 