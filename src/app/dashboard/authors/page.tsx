'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Author {
  id: number
  name: string
  slug: string
  bio?: string
  avatar_url?: string
  key_topics?: string[]
  articles_count: number
  is_featured: boolean
  last_published_at?: string
  contradiction_count?: number
}

interface Source {
  id: number
  name: string
  url: string
  description?: string
  articles_count: number
}

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAuthors()
    fetchSources()
  }, [])

  const fetchAuthors = async () => {
    try {
      const response = await fetch('/api/authors')
      if (!response.ok) throw new Error('Failed to fetch authors')
      const data = await response.json()
      setAuthors(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const fetchSources = async () => {
    try {
      const response = await fetch('/api/sources')
      if (!response.ok) throw new Error('Failed to fetch sources')
      const data = await response.json()
      setSources(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const setupSamAltman = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/demo-setup', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        alert('Demo setup successful! ' + data.message)
        fetchAuthors() // Refresh authors
        fetchSources() // Refresh sources
      } else {
        alert('Setup failed: ' + data.error)
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const syncAuthorContent = async (authorSlug: string) => {
    try {
      setLoading(true)
      const response = await fetch('/api/sync-author-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorSlug })
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert(`Content sync successful for ${data.authorName}!\n\n` +
              `Articles found: ${data.articlesFound}\n` +
              `New articles: ${data.newArticles}\n` +
              `Articles linked: ${data.articlesLinked}\n` +
              `Agent used: ${data.agentUsed}`)
        fetchAuthors() // Refresh to show updated article counts
      } else {
        alert('Sync failed: ' + data.error)
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900">Featured Thought Leaders</h1>
        <p className="mt-2 text-gray-600">
          Track the evolution of thinking from the most influential voices in AI, technology, and startups.
        </p>
      </div>

      {/* Phase 1 Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">1</span>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Phase 1: The "Insider's Edge" Launch
            </h2>
            <p className="text-gray-700 mb-4">
              Starting with single-author intelligence focusing on the most influential thought leaders. 
              Perfect for VCs, AI researchers, and superfans who need to track evolving perspectives.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                Contradiction Detection
              </span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                Evolution Tracking
              </span>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                Deep Analysis
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sam Altman Setup */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Phase 1 Demo Setup</h3>
            <p className="text-gray-600 mt-1">
              Load demo data featuring Sam Altman, Marc Andreessen, and Paul Graham to showcase the "Insider's Edge" system
            </p>
          </div>
          <Button 
            onClick={setupSamAltman}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Setup Demo Data
          </Button>
        </div>
      </div>

      {/* Featured Authors */}
      {authors.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Featured Authors</h2>
          <div className="grid gap-6">
            {authors.map((author) => (
              <div key={author.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-start space-x-4">
                  {author.avatar_url && (
                    <img 
                      src={author.avatar_url} 
                      alt={author.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-xl font-semibold text-gray-900">{author.name}</h3>
                        {author.is_featured && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            Featured
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => syncAuthorContent(author.slug)}
                        disabled={loading}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Sync Content
                      </Button>
                    </div>
                    <p className="text-gray-600 mb-3">{author.bio}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {author.key_topics?.map((topic, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                          {topic}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{author.articles_count} articles</span>
                      {author.contradiction_count !== undefined && (
                        <span className="text-red-600">
                          {author.contradiction_count} contradictions detected
                        </span>
                      )}
                      {author.last_published_at && (
                        <span>Last published: {new Date(author.last_published_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Sources (will become authors) */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Sources</h2>
        <p className="text-gray-600 mb-6">
          These sources will be converted to author profiles once the full schema is deployed.
        </p>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {sources.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600">No sources added yet. Start by setting up Sam Altman!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {sources.map((source) => (
              <div key={source.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{source.name}</h3>
                    <p className="text-gray-600 mt-1">{source.description}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {source.articles_count} articles • {source.url}
                    </p>
                  </div>
                  {source.name.includes('Sam Altman') && (
                    <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                      Featured
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Future Features Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Coming Soon: Author Intelligence Features</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-gray-700">Track position evolution over time</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-gray-700">Detect contradictions in new posts</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <span className="text-gray-700">Extract key themes and topics</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
              <span className="text-gray-700">Timeline view of thinking evolution</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
              <span className="text-gray-700">Smart alerts for position changes</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-indigo-400 rounded-full"></div>
              <span className="text-gray-700">Deep analysis of writing patterns</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 