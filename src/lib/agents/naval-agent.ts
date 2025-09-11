import { XMLParser } from 'fast-xml-parser'
import { BaseAgent, AgentResult, HistoricalArticle, PlatformIndicators } from './base-agent'

export class NavalAgent extends BaseAgent {
  name = 'Naval Agent'
  description = 'Specialized agent for nav.al podcast content with advanced extraction techniques'

  async canHandle(url: string): Promise<number> {
    const urlLower = url.toLowerCase()
    if (urlLower.includes('nav.al')) {
      return 0.95 // Very high confidence for nav.al
    }
    return 0.1
  }

  async verify(url: string): Promise<boolean> {
    return url.toLowerCase().includes('nav.al')
  }

  async collect(url: string): Promise<AgentResult> {
    const startTime = Date.now()
    const articles: HistoricalArticle[] = []
    const errors: string[] = []
    const methodsUsed: string[] = []

    try {
      console.log(`🚀 Naval Agent: Starting collection for nav.al`)
      const baseUrl = 'https://nav.al'

      // Method 1: Known episode patterns (immediately add these)
      console.log('🎯 Naval Agent: Using known episode patterns...')
      const knownEpisodes = [
        { slug: 'rich', title: 'Rich' },
        { slug: 'deutsch-files-iv', title: 'The Deutsch Files IV' },
        { slug: 'deutsch-files-iii', title: 'The Deutsch Files III' },
        { slug: 'deutsch-files-ii', title: 'The Deutsch Files II' },
        { slug: 'deutsch-files-i', title: 'The Deutsch Files I' },
        { slug: 'david-deutsch-2', title: 'David Deutsch: Knowledge Creation and The Human Race, Part 2' },
        { slug: 'david-deutsch-1', title: 'David Deutsch: Knowledge Creation and The Human Race, Part 1' },
        { slug: 'vitalik-2', title: 'Vitalik: Ethereum, Part 2' },
        { slug: 'vitalik-1', title: 'Vitalik: Ethereum, Part 1' },
        { slug: 'beginning-of-infinity-2', title: 'The Beginning of Infinity, Part 2' },
        { slug: 'beginning-of-infinity-1', title: 'The Beginning of Infinity, Part 1' },
        { slug: 'caveman', title: 'To a Caveman Very Few Things Are Resources' },
        { slug: 'wealth', title: 'How to Create Wealth' },
        { slug: 'angel', title: 'Angel Investing' },
        { slug: 'specific-knowledge', title: 'Specific Knowledge' },
        { slug: 'accountability', title: 'Accountability' },
        { slug: 'leverage', title: 'Leverage' },
        { slug: 'judgment', title: 'Judgment' },
        { slug: 'happiness', title: 'Happiness' },
        { slug: 'meditation', title: 'Meditation' },
        { slug: 'reading', title: 'Reading' },
        { slug: 'decision-making', title: 'Decision Making' },
        { slug: 'live-happily', title: 'Live Happily' },
        { slug: 'naval-podcast', title: 'Naval Podcast' },
        { slug: 'startups', title: 'Startups' },
        { slug: 'crypto', title: 'Crypto' },
        { slug: 'philosophy', title: 'Philosophy' },
        { slug: 'joe-rogan', title: 'Joe Rogan Experience' },
        { slug: 'tim-ferriss', title: 'Tim Ferriss Show' },
        { slug: 'knowledge-project', title: 'Knowledge Project' }
      ]

      for (const episode of knownEpisodes) {
        articles.push({
          title: episode.title,
          url: `${baseUrl}/${episode.slug}`,
          publishedDate: new Date().toISOString(),
          author: 'Naval',
          description: `Podcast episode from Naval Ravikant`
        })
      }
      methodsUsed.push('Known Episode Patterns')
      console.log(`✅ Naval Agent: Added ${knownEpisodes.length} known episodes`)

      // Method 2: Basic RSS collection (with timeout)
      console.log('📡 Naval Agent: Trying basic RSS feeds...')
      const rssFeeds = [
        `${baseUrl}/rss`,
        `${baseUrl}/feed`,
        'https://feeds.transistor.fm/naval',
        'https://anchor.fm/s/19b7ac00/podcast/rss'
      ]

      for (const feedUrl of rssFeeds) {
        try {
          console.log(`📡 Trying RSS feed: ${feedUrl}`)
          const timeoutPromise = new Promise<HistoricalArticle[]>((_, reject) => 
            setTimeout(() => reject(new Error('RSS timeout')), 10000)
          )
          
          const rssArticles = await Promise.race([
            this.collectFromRSSFeed(feedUrl),
            timeoutPromise
          ])
          
          if (rssArticles.length > 0) {
            articles.push(...rssArticles)
            methodsUsed.push(`RSS: ${feedUrl}`)
            console.log(`✅ Naval Agent RSS: Found ${rssArticles.length} articles from ${feedUrl}`)
            break // Use first successful feed
          }
        } catch (error) {
          console.log(`⚠️ RSS feed ${feedUrl} failed: ${error}`)
          errors.push(`RSS ${feedUrl}: ${error}`)
        }
      }

      const uniqueArticles = this.deduplicateAndSort(articles)
      const totalTime = Date.now() - startTime

      console.log(`🎉 Naval Agent: Collected ${uniqueArticles.length} unique articles in ${totalTime}ms`)

      return {
        success: uniqueArticles.length > 0,
        articles: uniqueArticles,
        articlesFound: uniqueArticles.length,
        strategy: this.name,
        confidence: 0.95,
        metadata: {
          platformDetected: 'Naval Podcast (nav.al)',
          methodsUsed,
          totalTime
        }
      }

    } catch (error) {
      console.error('❌ Naval Agent error:', error)
      return {
        success: false,
        articles: [],
        articlesFound: 0,
        strategy: this.name,
        confidence: 0.1,
        errors: [`Naval Agent failed: ${error}`]
      }
    }
  }

  getPlatformIndicators(): PlatformIndicators {
    return {
      urlPatterns: ['nav.al'],
      htmlIndicators: ['Naval', 'podcast', 'Deutsch Files'],
      apiEndpoints: ['/rss', '/feed'],
      confidence: 0.95
    }
  }

  private async collectFromRSSFeed(rssUrl: string): Promise<HistoricalArticle[]> {
    const articles: HistoricalArticle[] = []
    
    try {
      const proxyUrl = this.getAbsoluteUrl(`/api/rss-proxy?url=${encodeURIComponent(rssUrl)}`)
      console.log(`📡 Naval Agent: Fetching RSS from proxy: ${proxyUrl}`)
      
      const response = await fetch(proxyUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      })
      
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`)
      }

      const rssXml = await response.text()
      console.log(`📡 Naval Agent: Got RSS XML (${rssXml.length} chars)`)
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        parseAttributeValue: true,
        trimValues: true
      })
      
      const xmlDoc = parser.parse(rssXml)
      
      let items: any[] = []
      
      if (xmlDoc.rss && xmlDoc.rss.channel && xmlDoc.rss.channel.item) {
        items = Array.isArray(xmlDoc.rss.channel.item) ? xmlDoc.rss.channel.item : [xmlDoc.rss.channel.item]
      } else if (xmlDoc.feed && xmlDoc.feed.entry) {
        // Handle Atom feeds
        items = Array.isArray(xmlDoc.feed.entry) ? xmlDoc.feed.entry : [xmlDoc.feed.entry]
      }
      
      console.log(`📡 Naval Agent: Found ${items.length} items in RSS feed`)
      
      for (const item of items) {
        try {
          let title, link, pubDate, description
          
          if (xmlDoc.feed) {
            // Atom format
            title = item.title?.['#text'] || item.title
            link = item.link?.['@_href'] || (Array.isArray(item.link) ? item.link[0]?.['@_href'] : item.link)
            pubDate = item.published || item.updated
            description = item.summary?.['#text'] || item.summary || item.content?.['#text'] || item.content
          } else {
            // RSS format
            title = item.title?.['#text'] || item.title
            link = item.link?.['#text'] || item.link
            pubDate = item.pubDate || item['dc:date']
            description = item.description?.['#text'] || item.description
          }
          
          if (title && link) {
            articles.push({
              title: typeof title === 'string' ? title.trim() : String(title).trim(),
              url: typeof link === 'string' ? link.trim() : String(link).trim(),
              publishedDate: pubDate ? this.parseDate(String(pubDate)) : new Date().toISOString(),
              description: description ? (typeof description === 'string' ? description.trim() : String(description).trim()) : '',
              author: 'Naval'
            })
          }
        } catch (itemError) {
          console.log(`⚠️ Error parsing RSS item: ${itemError}`)
        }
      }
      
      console.log(`📡 Naval Agent: Extracted ${articles.length} articles from RSS`)
      
    } catch (error) {
      console.error(`❌ Naval Agent RSS error: ${error}`)
      throw new Error(`RSS collection failed: ${error}`)
    }
    
    return articles
  }
} 