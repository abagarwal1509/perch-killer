'use client'

import DOMPurify from 'dompurify'

export interface ProcessedContent {
  content: string
  isMarkdown: boolean
  hasImages: boolean
  wordCount: number
  readingTime: number
}

export class ContentProcessor {
  /**
   * Process and clean article content for optimal display
   */
  static processContent(rawContent: string, fallbackContent?: string): ProcessedContent {
    // Use the best available content
    const content = rawContent || fallbackContent || ''
    
    if (!content || content.trim().length === 0) {
      return {
        content: '',
        isMarkdown: false,
        hasImages: false,
        wordCount: 0,
        readingTime: 0
      }
    }

    // Detect if content is likely HTML or Markdown
    const isHTML = /<[^>]+>/.test(content)
    const isMarkdown = !isHTML && (/^#{1,6}\s/.test(content) || /\*\*.*\*\*/.test(content) || /\[.*\]\(.*\)/.test(content))
    
    let processedContent: string

    if (isHTML) {
      // Clean HTML content
      processedContent = this.cleanHTML(content)
    } else if (isMarkdown) {
      // Keep markdown as-is for react-markdown
      processedContent = content
    } else {
      // Convert plain text to markdown paragraphs
      processedContent = this.textToMarkdown(content)
    }

    // Calculate metrics
    const wordCount = this.getWordCount(processedContent)
    const readingTime = Math.ceil(wordCount / 200) // ~200 words per minute
    const hasImages = /!\[.*?\]\(.*?\)/.test(processedContent) || /<img[^>]*>/.test(processedContent)

    return {
      content: processedContent,
      isMarkdown: !isHTML,
      hasImages,
      wordCount,
      readingTime
    }
  }

  /**
   * Clean HTML content using DOMPurify
   */
  private static cleanHTML(html: string): string {
    if (typeof window === 'undefined') {
      // Server-side: basic cleanup
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
    }

    // Client-side: use DOMPurify
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'td', 'th'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
      ALLOW_DATA_ATTR: false
    })
  }

  /**
   * Convert plain text to markdown format
   */
  private static textToMarkdown(text: string): string {
    return text
      .split(/\n\s*\n/) // Split on double newlines
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .join('\n\n') // Join with proper markdown paragraph spacing
  }

  /**
   * Get word count from content
   */
  private static getWordCount(content: string): number {
    // Remove markdown/HTML and count words
    const plainText = content
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove image markdown
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[#*_`\[\]()]/g, '') // Remove markdown symbols
    
    return plainText.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  /**
   * Fix relative image URLs
   */
  static fixImageUrls(content: string, baseUrl?: string): string {
    if (!baseUrl) return content

    try {
      const base = new URL(baseUrl)
      
      return content.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        (match, alt, src) => {
          try {
            // If already absolute URL, keep as-is
            new URL(src)
            return match
          } catch {
            // Convert relative to absolute
            const absoluteUrl = new URL(src, base.origin).href
            return `![${alt}](${absoluteUrl})`
          }
        }
      )
    } catch {
      return content
    }
  }
}
