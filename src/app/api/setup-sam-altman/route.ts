import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    // For now, just add Sam Altman's blog as a regular source
    // We'll upgrade to the full author system once the schema is updated
    
    // Check if we already have his blog as a source
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .or('url.ilike.%blog.samaltman.com%,url.ilike.%samaltman.com%')

    if (sourcesError) {
      throw new Error(`Failed to check existing sources: ${sourcesError.message}`)
    }

    let source
    if (!sources || sources.length === 0) {
      // Add his blog as a source
      const { data: newSource, error: addError } = await supabase
        .from('sources')
        .insert({
          name: 'Sam Altman\'s Blog',
          url: 'https://blog.samaltman.com/rss',
          description: 'Personal blog of Sam Altman, CEO of OpenAI - Our first featured thought leader for tracking AI and startup insights',
          status: 'active'
        })
        .select()
        .single()

      if (addError) {
        throw new Error(`Failed to add source: ${addError.message}`)
      }
      
      source = newSource
    } else {
      source = sources[0]
    }

    return NextResponse.json({
      success: true,
      source: source,
      message: 'Sam Altman\'s blog set up successfully. This will be our first featured thought leader once we upgrade to the full author tracking system.',
      note: 'Author profile features will be available after database schema upgrade'
    })

  } catch (error) {
    console.error('Error setting up Sam Altman:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
} 