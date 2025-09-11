interface RSSItem {
  title: string
  description: string
  link: string
  pubDate: string
  author?: string
  categories?: string[]
  enclosure?: {
    url: string
    type: string
  }
}

interface ParsedFeed {
  title: string
  description: string
  link: string
  items: RSSItem[]
  feedUrl?: string // Add the actual feed URL that was discovered
}

export class RSSParser {
  static async fetchAndParse(url: string): Promise<ParsedFeed> {
    try {
      // Clean up the URL
      const cleanUrl = this.cleanUrl(url)
      
      // Try to discover and parse RSS feeds from the URL
      const feedUrl = await this.discoverFeed(cleanUrl)
      const parsedFeed = await this.parseDiscoveredFeed(feedUrl)
      
      // Add the discovered feed URL to the result
      return {
        ...parsedFeed,
        feedUrl
      }
    } catch (error) {
      console.error('Error parsing RSS feed:', error)
      if (error instanceof Error) {
        throw new Error(`RSS Feed Error: ${error.message}`)
      }
      throw new Error('Failed to find or parse RSS feed - please check the URL and try again')
    }
  }

  private static cleanUrl(url: string): string {
    // Add https:// if no protocol is provided
    if (!url.match(/^https?:\/\//)) {
      url = 'https://' + url
    }
    
    // Remove trailing slash
    return url.replace(/\/$/, '')
  }

  private static async discoverFeed(url: string): Promise<string> {
    const candidateUrls = await this.generateFeedCandidates(url)
    
    console.log(`🔍 Generated ${candidateUrls.length} feed candidates for ${url}:`, candidateUrls)
    
    for (const candidateUrl of candidateUrls) {
      try {
        console.log(`🧪 Trying feed URL: ${candidateUrl}`)
        
        const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(candidateUrl)}`
        const response = await fetch(proxyUrl)
        
        console.log(`📡 Response status for ${candidateUrl}: ${response.status}`)
        
        if (response.ok) {
          const content = await response.text()
          const isValidFeed = this.looksLikeFeed(content)
          
          console.log(`📝 Content length: ${content.length}, Is valid feed: ${isValidFeed}`)
          
          if (content && isValidFeed) {
            console.log(`✅ Found valid feed at: ${candidateUrl}`)
            return candidateUrl
          }
        }
      } catch (error) {
        // Continue to next candidate
        console.log(`❌ Failed to fetch ${candidateUrl}:`, error)
        continue
      }
    }
    
    throw new Error(`No RSS feed found for ${url}. Please try entering the direct RSS feed URL.`)
  }

  private static async generateFeedCandidates(url: string): Promise<string[]> {
    const candidates: string[] = []
    
    // Special handling for known sites with external feeds FIRST
    if (url.includes('paulgraham.com')) {
      console.log('🎯 Detected Paul Graham site - adding external feed')
      candidates.push('http://www.aaronsw.com/2002/feeds/pgessays.rss')
    }
    
    // First, try the URL as-is (might already be an RSS feed)
    candidates.push(url)
    
    // Try to discover feeds from HTML if it's a website
    try {
      const htmlFeeds = await this.discoverFeedsFromHTML(url)
      candidates.push(...htmlFeeds)
    } catch (error) {
      console.log('Could not discover feeds from HTML:', error)
    }
    
    // Add common RSS feed patterns
    const commonPatterns = [
      '/feed',
      '/feeds',
      '/rss',
      '/rss.xml',
      '/feed.xml',
      '/feeds/all.atom.xml',
      '/atom.xml',
      '/index.xml',
      '/feeds/posts/default',
      '/?feed=rss',
      '/?feed=rss2',
      '/?feed=atom'
    ]
    
    for (const pattern of commonPatterns) {
      candidates.push(url + pattern)
    }
    
    // Remove duplicates
    return [...new Set(candidates)]
  }

  private static async discoverFeedsFromHTML(url: string): Promise<string[]> {
    try {
      const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(url)}`
      const response = await fetch(proxyUrl)
      
      if (!response.ok) return []
      
      const html = await response.text()
      const feeds: string[] = []
      
      // Create a temporary DOM to parse HTML
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      
      // Look for RSS/Atom feed links in the HTML head
      const linkElements = doc.querySelectorAll('link[type*="rss"], link[type*="atom"], link[rel="alternate"]')
      
      linkElements.forEach((link) => {
        const href = link.getAttribute('href')
        const type = link.getAttribute('type')
        
        if (href && (
          type?.includes('rss') || 
          type?.includes('atom') || 
          href.includes('feed') || 
          href.includes('rss') ||
          href.includes('atom')
        )) {
          // Convert relative URLs to absolute, but keep external URLs as-is
          const feedUrl = href.startsWith('http') ? href : new URL(href, url).toString()
          feeds.push(feedUrl)
          console.log(`Found RSS feed link: ${feedUrl}`)
        }
              })
      
      return feeds
    } catch (error) {
      console.log('Error discovering feeds from HTML:', error)
      return []
    }
  }

  private static looksLikeFeed(content: string): boolean {
    const feedIndicators = [
      '<rss',
      '<feed',
      '<channel',
      '<item',
      '<entry',
      'xmlns="http://www.w3.org/2005/Atom"',
      'xmlns:atom="http://www.w3.org/2005/Atom"'
    ]
    
    const lowerContent = content.toLowerCase()
    return feedIndicators.some(indicator => lowerContent.includes(indicator.toLowerCase()))
  }

  private static async parseDiscoveredFeed(feedUrl: string): Promise<ParsedFeed> {
    const proxyUrl = `/api/rss-proxy?url=${encodeURIComponent(feedUrl)}`
    
    const response = await fetch(proxyUrl)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }
    
    const xmlText = await response.text()
    
    if (!xmlText || xmlText.trim().length === 0) {
      throw new Error('Empty response from RSS feed')
    }
    
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml')
    
    // Check for parser errors
    const parserError = xmlDoc.querySelector('parsererror')
    if (parserError) {
      throw new Error('Invalid XML format in RSS feed')
    }
    
    // Check if it's RSS or Atom
    const rootElement = xmlDoc.documentElement
    const isAtom = rootElement.tagName === 'feed' || rootElement.tagName === 'atom:feed'
    const isRSS = rootElement.tagName === 'rss' || rootElement.tagName === 'rdf:RDF'
    
    if (isAtom) {
      return this.parseAtom(xmlDoc)
    } else if (isRSS || rootElement.querySelector('channel')) {
      return this.parseRSS(xmlDoc)
    } else {
      // Try alternative parsing as last resort
      return this.parseAlternativeRSS(xmlDoc)
    }
  }

  private static parseRSS(xmlDoc: Document): ParsedFeed {
    const channel = xmlDoc.querySelector('channel')
    if (!channel) {
      // Try alternative RSS structures
      const rssElement = xmlDoc.querySelector('rss channel') || 
                        xmlDoc.querySelector('rdf\\:RDF') ||
                        xmlDoc.documentElement
      
      if (!rssElement) {
        throw new Error('Invalid RSS feed format - no channel or rss element found')
      }
      
      // Use the root element if no channel found
      return this.parseAlternativeRSS(xmlDoc)
    }

    const title = channel.querySelector('title')?.textContent || 'Unknown Feed'
    const description = channel.querySelector('description')?.textContent || ''
    const link = channel.querySelector('link')?.textContent || ''

    const items: RSSItem[] = []
    const itemElements = channel.querySelectorAll('item')

    itemElements.forEach((item) => {
      const title = item.querySelector('title')?.textContent || 'Untitled'
      const description = item.querySelector('description')?.textContent || ''
      const link = item.querySelector('link')?.textContent || ''
      const pubDate = item.querySelector('pubDate')?.textContent || ''
      const author = item.querySelector('author')?.textContent || 
                    item.querySelector('dc\\:creator')?.textContent || ''

      // Extract categories
      const categoryElements = item.querySelectorAll('category')
      const categories: string[] = []
      categoryElements.forEach((cat) => {
        const text = cat.textContent
        if (text) categories.push(text)
      })

      // Extract enclosure (for images)
      const enclosureElement = item.querySelector('enclosure')
      let enclosure = undefined
      if (enclosureElement) {
        enclosure = {
          url: enclosureElement.getAttribute('url') || '',
          type: enclosureElement.getAttribute('type') || ''
        }
      }

      items.push({
        title: this.cleanText(title),
        description: this.cleanText(description),
        link,
        pubDate,
        author,
        categories,
        enclosure
      })
    })

    return {
      title: this.cleanText(title),
      description: this.cleanText(description),
      link,
      items
    }
  }

  private static parseAlternativeRSS(xmlDoc: Document): ParsedFeed {
    // Try to parse feeds that don't follow standard RSS format
    const root = xmlDoc.documentElement
    
    const title = root.querySelector('title')?.textContent || 
                 root.querySelector('channel title')?.textContent || 
                 'Unknown Feed'
    const description = root.querySelector('description')?.textContent || 
                       root.querySelector('channel description')?.textContent || ''
    const link = root.querySelector('link')?.textContent || 
                root.querySelector('channel link')?.textContent || ''

    const items: RSSItem[] = []
    // Try different item selectors
    const itemElements = root.querySelectorAll('item') || 
                        root.querySelectorAll('entry') ||
                        root.querySelectorAll('channel item')

    itemElements.forEach((item) => {
      const title = item.querySelector('title')?.textContent || 'Untitled'
      const description = item.querySelector('description')?.textContent || 
                         item.querySelector('summary')?.textContent || ''
      const link = item.querySelector('link')?.textContent || 
                  item.querySelector('link')?.getAttribute('href') || ''
      const pubDate = item.querySelector('pubDate')?.textContent || 
                     item.querySelector('published')?.textContent ||
                     item.querySelector('updated')?.textContent || ''

      items.push({
        title: this.cleanText(title),
        description: this.cleanText(description),
        link,
        pubDate,
        author: '',
        categories: []
      })
    })

    return {
      title: this.cleanText(title),
      description: this.cleanText(description),
      link,
      items
    }
  }

  private static parseAtom(xmlDoc: Document): ParsedFeed {
    const feed = xmlDoc.documentElement
    
    const title = feed.querySelector('title')?.textContent || 'Unknown Feed'
    const subtitle = feed.querySelector('subtitle')?.textContent || ''
    const linkElement = feed.querySelector('link[rel="alternate"]') || feed.querySelector('link')
    const link = linkElement?.getAttribute('href') || ''

    const items: RSSItem[] = []
    const entryElements = feed.querySelectorAll('entry')

    entryElements.forEach((entry) => {
      const title = entry.querySelector('title')?.textContent || 'Untitled'
      const summary = entry.querySelector('summary')?.textContent || 
                     entry.querySelector('content')?.textContent || ''
      const linkElement = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link')
      const link = linkElement?.getAttribute('href') || ''
      const published = entry.querySelector('published')?.textContent || 
                       entry.querySelector('updated')?.textContent || ''
      const authorElement = entry.querySelector('author name')
      const author = authorElement?.textContent || ''

      // Extract categories
      const categoryElements = entry.querySelectorAll('category')
      const categories: string[] = []
      categoryElements.forEach((cat) => {
        const term = cat.getAttribute('term')
        if (term) categories.push(term)
      })

      items.push({
        title: this.cleanText(title),
        description: this.cleanText(summary),
        link,
        pubDate: published,
        author,
        categories
      })
    })

    return {
      title: this.cleanText(title),
      description: this.cleanText(subtitle),
      link,
      items
    }
  }

  private static cleanText(text: string): string {
    // Remove HTML tags and decode HTML entities
    const div = document.createElement('div')
    div.innerHTML = text
    return div.textContent || div.innerText || ''
  }

  static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffTime = Math.abs(now.getTime() - date.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays === 1) {
        return '1 day ago'
      } else if (diffDays < 7) {
        return `${diffDays} days ago`
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7)
        return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
      } else {
        return date.toLocaleDateString()
      }
    } catch {
      return dateString
    }
  }

  static extractImageFromContent(content: string): string | null {
    // Try to extract the first image from HTML content
    const div = document.createElement('div')
    div.innerHTML = content
    const img = div.querySelector('img')
    return img?.src || null
  }

  static estimateReadingTime(content: string): string {
    const wordsPerMinute = 200
    const cleanContent = this.cleanText(content)
    const wordCount = cleanContent.split(/\s+/).length
    const minutes = Math.ceil(wordCount / wordsPerMinute)
    return `${minutes} min read`
  }
}

// Types for better TypeScript support
export type { RSSItem, ParsedFeed } 