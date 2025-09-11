import { NextRequest, NextResponse } from 'next/server'

interface ContentExtractionResult {
  success: boolean
  content?: string
  title?: string
  author?: string
  publishedDate?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    console.log('Extracting content from:', url)

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    
    // Extract content using simple DOM parsing
    const extractedContent = extractMainContent(html)
    
    console.log('Content extraction result:', {
      success: extractedContent.success,
      contentLength: extractedContent.content?.length || 0,
      title: extractedContent.title?.substring(0, 50) + '...'
    })

    return NextResponse.json(extractedContent)

  } catch (error) {
    console.error('Content extraction error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to extract content'
      },
      { status: 500 }
    )
  }
}

function extractMainContent(html: string): ContentExtractionResult {
  try {
    // Remove ads, tracking, and unnecessary elements before processing
    let cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove common ad containers
      .replace(/<div[^>]*class=["\'][^"']*(?:ad|advertisement|banner|sidebar|header|footer|nav|menu|popup|modal)[^"']*["\'][^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')

    // Extract title
    const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : undefined

    // Look for common article content selectors with priority
    const contentSelectors = [
      // High priority - semantic article tags
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      // Medium priority - content containers
      /<div[^>]*class=["\'][^"']*(?:post-content|entry-content|article-content|content-body)[^"']*["\'][^>]*>([\s\S]*?)<\/div>/gi,
      /<main[^>]*class=["\'][^"']*(?:content|main)[^"']*["\'][^>]*>([\s\S]*?)<\/main>/gi,
      // Lower priority - generic containers
      /<div[^>]*class=["\'][^"']*(?:content|article|post|entry)[^"']*["\'][^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*id=["\'](?:content|main|article)["\'][^>]*>([\s\S]*?)<\/div>/gi,
    ]

    let extractedContent = ''
    
    for (const selector of contentSelectors) {
      const matches = cleanHtml.match(selector)
      if (matches && matches.length > 0) {
        // Use the longest match (likely the main content)
        const longestMatch = matches.reduce((longest, current) => 
          current.length > longest.length ? current : longest, ''
        )
        
        if (longestMatch.length > extractedContent.length) {
          extractedContent = longestMatch
          break // Use first good match to avoid noise
        }
      }
    }

    // If no specific content found, try to extract structured content
    if (!extractedContent || extractedContent.length < 500) {
      const paragraphs = cleanHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []
      if (paragraphs.length > 3) {
        extractedContent = paragraphs.join('\n')
      }
    }

    // Enhanced content processing with media preservation
    if (extractedContent) {
      // Step 1: Extract and preserve media elements
      const mediaElements: Array<{type: string, content: string, placeholder: string}> = []
      let mediaCounter = 0

      // Preserve YouTube embeds
      extractedContent = extractedContent.replace(
        /<iframe[^>]*(?:youtube\.com|youtu\.be)[^>]*>[\s\S]*?<\/iframe>/gi,
        (match) => {
          const srcMatch = match.match(/src=["\']([^"']+)["\']/)
          if (srcMatch) {
            const placeholder = `__MEDIA_${mediaCounter++}__`
            mediaElements.push({
              type: 'youtube',
              content: srcMatch[1],
              placeholder
            })
            return placeholder
          }
          return ''
        }
      )

      // Preserve images
      extractedContent = extractedContent.replace(
        /<img[^>]*src=["\']([^"']+)["\'][^>]*>/gi,
        (match, src) => {
          // Skip tiny images (likely ads/tracking pixels)
          const widthMatch = match.match(/width=["\']?(\d+)["\']?/)
          const heightMatch = match.match(/height=["\']?(\d+)["\']?/)
          const width = widthMatch ? parseInt(widthMatch[1]) : 0
          const height = heightMatch ? parseInt(heightMatch[1]) : 0
          
          if (width > 0 && height > 0 && (width < 50 || height < 50)) {
            return '' // Skip small images
          }

          const altMatch = match.match(/alt=["\']([^"']*)["\']/)
          const alt = altMatch ? altMatch[1] : ''
          
          const placeholder = `__MEDIA_${mediaCounter++}__`
          mediaElements.push({
            type: 'image',
            content: JSON.stringify({ src, alt }),
            placeholder
          })
          return placeholder
        }
      )

      // Step 2: Clean and structure text content
      extractedContent = extractedContent
        // Preserve headings with better formatting
        .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, '\n\n## $2\n\n')
        // Preserve blockquotes
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
          const cleanQuote = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          return `\n\n> ${cleanQuote}\n\n`
        })
        // Preserve lists
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '\n$1\n')
        .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '\n$1\n')
        // Clean paragraphs
        .replace(/<p[^>]*>/gi, '\n\n')
        .replace(/<\/p>/gi, '')
        // Remove remaining HTML but preserve formatting tags temporarily
        .replace(/<\/?(strong|b)[^>]*>/gi, '**')
        .replace(/<\/?(em|i)[^>]*>/gi, '*')
        .replace(/<br[^>]*>/gi, '\n')
        // Remove all other HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        // Clean whitespace
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim()

      // Step 3: Restore media elements with structured format
      mediaElements.forEach(media => {
        if (media.type === 'youtube') {
          extractedContent = extractedContent.replace(
            media.placeholder,
            `\n\n[YOUTUBE: ${media.content}]\n\n`
          )
        } else if (media.type === 'image') {
          const imageData = JSON.parse(media.content)
          extractedContent = extractedContent.replace(
            media.placeholder,
            `\n\n[IMAGE: ${imageData.src}${imageData.alt ? ` | Alt: ${imageData.alt}` : ''}]\n\n`
          )
        }
      })

      // Step 4: Filter out common noise patterns
      const noisePatterns = [
        /subscribe to.*newsletter/gi,
        /follow us on/gi,
        /share this article/gi,
        /related articles/gi,
        /advertisement/gi,
        /sponsored content/gi,
        /cookie policy/gi,
        /privacy policy/gi,
        /terms of service/gi,
        /\b(ads?|advertisement)\b/gi
      ]

      // Split into paragraphs and filter
      const paragraphs = extractedContent.split('\n\n')
      const filteredParagraphs = paragraphs.filter(para => {
        const trimmed = para.trim()
        if (trimmed.length < 20) return false // Too short
        if (noisePatterns.some(pattern => pattern.test(trimmed))) return false
        return true
      })

      extractedContent = filteredParagraphs.join('\n\n')
    }

    // Check if extraction was successful
    if (!extractedContent || extractedContent.length < 200) {
      return {
        success: false,
        error: 'Could not extract sufficient content from the webpage'
      }
    }

    return {
      success: true,
      content: extractedContent,
      title: title
    }

  } catch (error) {
    console.error('Content parsing error:', error)
    return {
      success: false,
      error: 'Failed to parse webpage content'
    }
  }
} 