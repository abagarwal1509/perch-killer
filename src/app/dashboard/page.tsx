'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Clock, ExternalLink, Loader2 } from 'lucide-react'
import { ArticleReader } from '@/components/article-reader'
import { DatabaseService, Source, ArticleWithSource } from '@/lib/database'

// Color mapping for sources (can be randomized or configured)
const sourceColors = [
  'bg-blue-500',
  'bg-purple-500', 
  'bg-red-500',
  'bg-orange-500',
  'bg-green-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-yellow-500'
]

const getSourceColor = (sourceName: string) => {
  const hash = sourceName.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return sourceColors[Math.abs(hash) % sourceColors.length]
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`
  } else if (diffInMinutes < 1440) {
    return `${Math.floor(diffInMinutes / 60)}h ago`
  } else {
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }
}

export default function DiscoverPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [articles, setArticles] = useState<ArticleWithSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSource, setSelectedSource] = useState<string>('all')
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithSource | null>(null)
  const [isReaderOpen, setIsReaderOpen] = useState(false)
  const db = new DatabaseService()

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [fetchedSources, fetchedArticles] = await Promise.all([
        db.getSources(),
        db.getArticles() // Get all articles (no limit)
      ])
      setSources(fetchedSources)
      setArticles(fetchedArticles)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredArticles = selectedSource === 'all' 
    ? articles 
    : articles.filter(article => article.source_name === selectedSource)

  const handleArticleClick = (article: ArticleWithSource) => {
    setSelectedArticle(article)
    setIsReaderOpen(true)
  }

  const handleCloseReader = () => {
    setIsReaderOpen(false)
    setSelectedArticle(null)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-6">
            <h1 className="text-2xl font-semibold mb-6">Discover</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mb-4 mx-auto" />
            <p className="text-muted-foreground">Loading articles...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-6">
          <h1 className="text-2xl font-semibold mb-6">Discover</h1>
          
          {/* Blog Filter Buttons */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            <Button
              variant={selectedSource === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSource('all')}
              className="whitespace-nowrap"
            >
              All Sources ({articles.length})
            </Button>
            {sources.map((source) => {
              const sourceArticleCount = articles.filter(a => a.source_name === source.name).length
              return (
                <Button
                  key={source.id}
                  variant={selectedSource === source.name ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedSource(source.name)}
                  className="whitespace-nowrap"
                >
                  <div className={`w-2 h-2 rounded-full ${getSourceColor(source.name)} mr-2`} />
                  {source.name} ({sourceArticleCount})
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredArticles.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => handleArticleClick(article)}
                className="group cursor-pointer bg-card rounded-xl border border-border hover:border-border/60 transition-all duration-200 hover:shadow-lg overflow-hidden"
              >
                {/* Article Image */}
                {article.image_url && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                )}
                
                {/* Article Content */}
                <div className="p-5">
                  {/* Blog Badge */}
                  <div className="flex items-center space-x-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${getSourceColor(article.source_name)}`} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {article.source_name}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-lg leading-tight mb-3 group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>

                  {/* Snippet */}
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-3">
                    {article.description || 'No description available...'}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {article.published_at 
                            ? formatTimeAgo(article.published_at)
                            : formatTimeAgo(article.created_at)
                          }
                        </span>
                      </div>
                      {article.read_time && (
                        <span>{article.read_time}</span>
                      )}
                      {article.author && (
                        <span>by {article.author}</span>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <ExternalLink className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No articles found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              {selectedSource === 'all' 
                ? sources.length === 0
                  ? "Start by adding your first blog source to see articles here."
                  : "No articles available yet. Try refreshing your sources or adding new ones."
                : `No articles from ${selectedSource} yet. Try refreshing this source.`
              }
            </p>
            <Button onClick={() => window.location.href = '/dashboard/connect'}>
              {sources.length === 0 ? 'Add Your First Source' : 'Manage Sources'}
            </Button>
          </div>
        )}
      </div>

      {/* Article Reader Modal */}
      {isReaderOpen && selectedArticle && (
        <ArticleReader
          article={{
            id: selectedArticle.id,
            title: selectedArticle.title,
            content: selectedArticle.content || '',
            snippet: selectedArticle.description || 'No description available',
            blog: selectedArticle.source_name,
            publishedAt: selectedArticle.published_at 
              ? formatTimeAgo(selectedArticle.published_at)
              : formatTimeAgo(selectedArticle.created_at),
            readTime: selectedArticle.read_time || '5 min read',
            image: selectedArticle.image_url || '',
            url: selectedArticle.url,
            author: selectedArticle.author || ''
          }}
          isOpen={isReaderOpen}
          onClose={handleCloseReader}
        />
      )}
    </div>
  )
} 