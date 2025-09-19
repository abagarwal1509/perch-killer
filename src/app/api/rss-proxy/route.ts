import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
  }

  try {
    // Validate URL format
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 })
    }

    // Fetch the RSS feed
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BlogHub RSS Reader/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 seconds timeout
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch RSS feed: ${response.status} ${response.statusText}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    
    // Check if the response is likely to be XML
    if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
      // Still try to parse it, but warn
      console.warn('Response might not be XML:', contentType)
    }

    const xmlContent = await response.text()

    // Special handling for Next.js websites like VCCircle that return HTML instead of RSS
    const domain = new URL(url).hostname
    if ((domain.includes('vccircle.com') || xmlContent.includes('__NEXT_DATA__')) && 
        contentType.includes('text/html')) {
      // This is a Next.js website that our specialized agent can handle
      return NextResponse.json(
        { 
          success: true,
          message: 'This website uses a modern framework that our specialized agents can extract content from.',
          note: 'RSS validation bypassed for Next.js websites with specialized agent support.'
        },
        { status: 200 }
      )
    }

    // Basic validation - check if it looks like XML
    if (!xmlContent.trim().startsWith('<')) {
      return NextResponse.json(
        { error: 'Response does not appear to be valid XML. Please check if the URL is a valid RSS/Atom feed.' },
        { status: 400 }
      )
    }

    // Additional validation - check if it contains feed-like elements
    const hasRSSElements = xmlContent.includes('<rss') || 
                          xmlContent.includes('<channel') || 
                          xmlContent.includes('<feed') ||
                          xmlContent.includes('<item') ||
                          xmlContent.includes('<entry')
    
    if (!hasRSSElements) {
      return NextResponse.json(
        { error: 'URL does not appear to contain RSS/Atom feed content. Please verify the feed URL.' },
        { status: 400 }
      )
    }

    // Return the XML content with proper headers
    return new NextResponse(xmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('RSS proxy error:', error)
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Network error: Could not fetch the RSS feed' },
        { status: 502 }
      )
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout: RSS feed took too long to respond' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching the RSS feed' },
      { status: 500 }
    )
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
} 