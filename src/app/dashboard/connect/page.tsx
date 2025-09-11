'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Globe, Trash2, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { RSSParser } from '@/lib/rss-parser'
import { DatabaseService, Source } from '@/lib/database'
import { CollectionOrchestrator } from '@/lib/agents'

// Helper function to estimate read time
function estimateReadTime(content: string): string {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wordsPerMinute)
  return `${minutes} min read`
}

export default function ConnectPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const db = new DatabaseService()

  // Load sources on component mount
  useEffect(() => {
    loadSources()
  }, [])

  const loadSources = async () => {
    try {
      setIsLoading(true)
      const fetchedSources = await db.getSources()
      setSources(fetchedSources)
    } catch (error) {
      console.error('Error loading sources:', error)
      setError('Failed to load sources. Please refresh the page.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddSource = async () => {
    if (!newUrl.trim()) {
      setError('Please enter a valid URL')
      return
    }
    
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      // First, validate the URL and try to get basic feed info for source metadata
      let feedTitle = 'Unknown Blog'
      let feedDescription = 'Recently added blog source'
      
      try {
        const parsedFeed = await RSSParser.fetchAndParse(newUrl.trim())
        feedTitle = parsedFeed.title || feedTitle
        feedDescription = parsedFeed.description || feedDescription
      } catch (rssError) {
        console.log('RSS parsing failed, will use agent system for content discovery')
        // Extract title from URL as fallback
        try {
          const url = new URL(newUrl.trim())
          feedTitle = url.hostname.replace('www.', '').replace('.com', '').replace('.org', '').replace('.net', '')
          feedTitle = feedTitle.charAt(0).toUpperCase() + feedTitle.slice(1) + ' Blog'
        } catch {
          // Keep default title
        }
      }
      
      // Create the source first
      const newSource = await db.addSource({
        name: feedTitle,
        url: newUrl.trim(),
        description: feedDescription,
        status: 'active',
        last_fetched_at: new Date().toISOString(),
        articles_count: 0 // Will be updated after collection
      })
      
      // 🚀 UNIFIED: Use agent-based collection system for complete content
      console.log(`🤖 Starting unified agent-based collection for ${newSource.name}...`)
      
      const orchestrator = new CollectionOrchestrator()
      const collectionResult = await orchestrator.collectHistoricalArticles(newUrl.trim())
      
      let totalArticles = 0
      let collectionInfo = ''
      
      if (collectionResult.success && collectionResult.articles.length > 0) {
        console.log(`📚 Agent system found ${collectionResult.articles.length} articles using ${collectionResult.agentUsed}`)
        
                 // Convert agent results to database format with complete content
         const agentArticles = collectionResult.articles.map((article: any) => ({
           source_id: newSource.id,
           title: article.title,
           description: article.description || 'Article collected via intelligent agent system',
           content: article.content || article.description, // Full content from agents
           url: article.url,
           author: article.author || newSource.name,
           published_at: article.publishedDate,
           image_url: article.imageUrl,
           categories: [],
           read_time: estimateReadTime(article.content || article.description || ''),
           is_read: false,
           is_bookmarked: false,
           is_enhanced: !!article.content, // Mark as enhanced if we have full content
           content_length: (article.content || '').length,
           ai_analysis: {},
           key_quotes: [],
           main_themes: [],
           contradicts_previous: false,
           related_article_ids: []
         }))
        
        // Store all articles with complete content
        const storedArticles = await db.addArticles(agentArticles)
        totalArticles = storedArticles.length
        
        // Update source with actual article count
        await db.updateSource(newSource.id, {
          articles_count: totalArticles
        })
        
        collectionInfo = ` using ${collectionResult.agentUsed} agent`
        console.log(`✅ Successfully added ${totalArticles} complete articles`)
      } else {
        console.log('⚠️ Agent collection failed or found no articles, falling back to RSS if available')
        
        // Fallback to RSS if agent system fails
        try {
          const parsedFeed = await RSSParser.fetchAndParse(newUrl.trim())
                     const rssArticles = parsedFeed.items.map(item => ({
             source_id: newSource.id,
             title: item.title,
             description: item.description,
             content: item.description, // RSS content (limited)
             url: item.link,
             author: item.author,
             published_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
             image_url: item.enclosure?.url || undefined,
             categories: item.categories || [],
             read_time: estimateReadTime(item.description || ''),
             is_read: false,
             is_bookmarked: false,
             is_enhanced: false, // Mark as not enhanced (RSS only)
             content_length: (item.description || '').length,
             ai_analysis: {},
             key_quotes: [],
             main_themes: [],
             contradicts_previous: false,
             related_article_ids: []
           }))
          
          const storedArticles = await db.addArticles(rssArticles)
          totalArticles = storedArticles.length
          
          await db.updateSource(newSource.id, {
            articles_count: totalArticles
          })
          
          collectionInfo = ' (RSS fallback - limited content)'
        } catch (fallbackError) {
          console.error('Both agent and RSS collection failed:', fallbackError)
          collectionInfo = ' (collection failed - source added for future sync)'
        }
      }

      setSources([newSource, ...sources])
      
      // Enhanced success message with agent information
      setSuccess(`Successfully added "${feedTitle}" with ${totalArticles} articles${collectionInfo}!`)
      
      // Clear form after 3 seconds
      setTimeout(() => {
        setNewUrl('')
        setShowAddModal(false)
        setSuccess('')
      }, 3000)
      
    } catch (error) {
      console.error('Error adding source:', error)
      setError(error instanceof Error ? error.message : 'Failed to add source. Please check the URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async (sourceId: number) => {
    const sourceToRefresh = sources.find(s => s.id === sourceId)
    if (!sourceToRefresh) return

    // Update status to show loading  
    setSources(sources.map(source => 
      source.id === sourceId 
        ? { ...source, status: 'loading' as any }
        : source
    ))

    try {
      console.log(`🔄 Refreshing ${sourceToRefresh.name} using unified agent system...`)
      
      // 🚀 UNIFIED: Use agent system for refresh too
      const orchestrator = new CollectionOrchestrator()
      const collectionResult = await orchestrator.collectHistoricalArticles(sourceToRefresh.url)
      
      let newArticlesCount = 0
      
      if (collectionResult.success && collectionResult.articles.length > 0) {
                 // Convert and store new articles
         const agentArticles = collectionResult.articles.map((article: any) => ({
           source_id: sourceId,
           title: article.title,
           description: article.description || 'Article collected via intelligent agent system',
           content: article.content || article.description,
           url: article.url,
           author: article.author || sourceToRefresh.name,
           published_at: article.publishedDate,
           image_url: article.imageUrl,
           categories: [],
           read_time: estimateReadTime(article.content || article.description || ''),
           is_read: false,
           is_bookmarked: false,
           is_enhanced: !!article.content,
           content_length: (article.content || '').length,
           ai_analysis: {},
           key_quotes: [],
           main_themes: [],
           contradicts_previous: false,
           related_article_ids: []
         }))
        
        // Store articles (upsert will handle duplicates)
        const storedArticles = await db.addArticles(agentArticles)
        newArticlesCount = storedArticles.length
        
        console.log(`📚 Agent refresh found ${collectionResult.articles.length} articles, stored ${newArticlesCount} new ones`)
      } else {
        console.log('⚠️ Agent refresh failed, falling back to RSS')
        
        // Fallback to RSS refresh
        const parsedFeed = await RSSParser.fetchAndParse(sourceToRefresh.url)
                 const rssArticles = parsedFeed.items.map(item => ({
           source_id: sourceId,
           title: item.title,
           description: item.description,
           content: item.description,
           url: item.link,
           author: item.author,
           published_at: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
           image_url: item.enclosure?.url || undefined,
           categories: item.categories || [],
           read_time: estimateReadTime(item.description || ''),
           is_read: false,
           is_bookmarked: false,
           is_enhanced: false,
           content_length: (item.description || '').length,
           ai_analysis: {},
           key_quotes: [],
           main_themes: [],
           contradicts_previous: false,
           related_article_ids: []
         }))
        
        const storedArticles = await db.addArticles(rssArticles)
        newArticlesCount = storedArticles.length
      }
      
      // Update the source
      const updatedSource = await db.updateSource(sourceId, {
        status: 'active',
        last_fetched_at: new Date().toISOString()
      })
      
      setSources(sources.map(source => 
        source.id === sourceId ? updatedSource : source
      ))
      
      console.log(`✅ Refreshed ${sourceToRefresh.name} - ${newArticlesCount} new articles`)
      
    } catch (error) {
      console.error('Error refreshing source:', error)
      try {
        const errorSource = await db.updateSource(sourceId, { 
          status: 'error', 
          last_fetched_at: new Date().toISOString() 
        })
        setSources(sources.map(source => 
          source.id === sourceId ? errorSource : source
        ))
      } catch (updateError) {
        console.error('Error updating source status:', updateError)
      }
    }
  }

  const handleCollectHistorical = async (sourceId: number) => {
    const source = sources.find(s => s.id === sourceId)
    if (!source) return

    // Update status to show loading
    setSources(sources.map(s => 
      s.id === sourceId 
        ? { ...s, status: 'loading' as any }
        : s
    ))

    try {
      console.log(`🏛️ Enhanced historical collection for ${source.name} using agent system...`)
      
      // 🚀 UNIFIED: Use agent system for historical collection
      const orchestrator = new CollectionOrchestrator()
      const collectionResult = await orchestrator.collectHistoricalArticles(source.url)
      
      if (collectionResult.success && collectionResult.articles.length > 0) {
                 // Convert to database format with complete content
         const historicalDbArticles = collectionResult.articles.map((article: any) => ({
           source_id: sourceId,
           title: article.title,
           description: article.description || `Historical article from ${article.author || 'unknown author'}`,
           content: article.content || article.description,
           url: article.url,
           author: article.author || source.name,
           published_at: article.publishedDate,
           image_url: article.imageUrl,
           categories: [],
           read_time: estimateReadTime(article.content || article.description || ''),
           is_read: false,
           is_bookmarked: false,
           is_enhanced: !!article.content,
           content_length: (article.content || '').length,
           ai_analysis: {},
           key_quotes: [],
           main_themes: [],
           contradicts_previous: false,
           related_article_ids: []
         }))
        
        // Store articles (duplicates handled by constraints)
        const storedArticles = await db.addArticles(historicalDbArticles)
        
        // Refresh sources to get updated article count from database
        await loadSources()
        
        // Update source status
        const updatedSource = await db.updateSource(sourceId, {
          status: 'active',
          last_fetched_at: new Date().toISOString()
        })
        
        setSources(sources.map(s => 
          s.id === sourceId ? updatedSource : s
        ))
        
        setSuccess(`🏛️ Added ${storedArticles.length} complete historical articles using ${collectionResult.agentUsed}!`)
        setTimeout(() => setSuccess(''), 3000)
        
      } else {
        // No historical articles found
        const updatedSource = await db.updateSource(sourceId, {
          status: 'active',
          last_fetched_at: new Date().toISOString()
        })
        
        setSources(sources.map(s => 
          s.id === sourceId ? updatedSource : s
        ))
        
        setError(`No additional historical articles found for ${source.name}`)
        setTimeout(() => setError(''), 3000)
      }
      
    } catch (error) {
      console.error('Historical collection error:', error)
      
      // Reset status to active
      const errorSource = await db.updateSource(sourceId, { 
        status: 'active',
        last_fetched_at: new Date().toISOString()
      })
      setSources(sources.map(s => 
        s.id === sourceId ? errorSource : s
      ))
      
      // Better error messaging
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      setError(`Failed to collect historical articles: ${errorMessage}`)
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleDelete = async (sourceId: number) => {
    try {
      await db.deleteSource(sourceId)
      setSources(sources.filter(source => source.id !== sourceId))
    } catch (error) {
      console.error('Error deleting source:', error)
      setError('Failed to delete source. Please try again.')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'loading':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active'
      case 'error':
        return 'Error'
      case 'loading':
        return 'Loading...'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-2">Connect</h1>
              <p className="text-muted-foreground">
                Manage your blog sources and RSS feeds
              </p>
            </div>
            <Button onClick={() => {
              setShowAddModal(true)
              setError('')
              setSuccess('')
              setNewUrl('')
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Source
            </Button>
          </div>
        </div>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
            <p className="text-muted-foreground">Loading your sources...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => (
              <div
                key={source.id}
                className="bg-card rounded-xl border border-border p-6 hover:border-border/60 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Globe className="w-5 h-5 text-muted-foreground" />
                      <h3 className="font-semibold text-lg">{source.name}</h3>
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(source.status)}
                        <span className="text-sm text-muted-foreground">
                          {getStatusText(source.status)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mb-3">
                      {source.description}
                    </p>
                    
                    <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                      <span className="font-mono bg-muted px-2 py-1 rounded text-xs">
                        {source.url}
                      </span>
                      <span>{source.articles_count} articles</span>
                      <span>Last updated {source.last_fetched_at ? new Date(source.last_fetched_at).toLocaleString() : 'Never'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefresh(source.id)}
                      title="Refresh latest articles"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCollectHistorical(source.id)}
                      title="Collect complete historical archive"
                      className="text-purple-600 hover:text-purple-700"
                    >
                      🏛️
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(source.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {sources.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Globe className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No sources connected</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  Connect your first blog or RSS feed to start discovering great content.
                </p>
                <Button onClick={() => {
                  setShowAddModal(true)
                  setError('')
                  setSuccess('')
                  setNewUrl('')
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Source
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Add New Source</h2>
              <button
                onClick={() => {
                  if (!loading) {
                    setShowAddModal(false)
                    setNewUrl('')
                    setError('')
                    setSuccess('')
                  }
                }}
                className="text-muted-foreground hover:text-foreground text-xl"
                disabled={loading}
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Website or RSS Feed URL
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://techcrunch.com or https://example.com/feed"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading) {
                      handleAddSource()
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter any website URL and we'll automatically find its RSS feed
                </p>
                
                {/* Quick Examples */}
                {!loading && !error && !success && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Try these examples:</p>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { name: 'TechCrunch', url: 'https://techcrunch.com' },
                        { name: 'The Verge', url: 'https://www.theverge.com' },
                        { name: 'Ars Technica', url: 'https://arstechnica.com' }
                      ].map((example) => (
                        <button
                          key={example.name}
                          onClick={() => setNewUrl(example.url)}
                          className="text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded transition-colors"
                        >
                          {example.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
              
              {/* Success Message */}
              {success && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <Button 
                  onClick={() => {
                    if (!loading) {
                      setShowAddModal(false)
                      setNewUrl('')
                      setError('')
                      setSuccess('')
                    }
                  }}
                  variant="outline" 
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddSource}
                  className="flex-1"
                  disabled={loading || !newUrl.trim()}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Source'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 