'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  X, ExternalLink, Share2, Bookmark, Clock, Calendar, Download, 
  Sparkles, Sun, Moon, Type, Minus, Plus, MoreHorizontal, 
  ArrowLeft, Heart, MessageSquare, Repeat, Settings 
} from 'lucide-react'
import EnhancedArticleContent from './enhanced-article-content'

interface Article {
  id: number
  title: string
  content?: string
  description?: string
  snippet?: string
  blog?: string
  source_name?: string
  publishedAt?: string
  published_at?: string
  readTime?: string
  read_time?: string
  image?: string
  image_url?: string
  url: string
  author?: string
  publishedDate?: string
}

interface ArticleReaderProps {
  article: Article | null
  isOpen: boolean
  onClose: () => void
}

// Reading themes
const themes = {
  light: {
    bg: 'bg-white',
    text: 'text-gray-900',
    accent: 'text-gray-600',
    border: 'border-gray-200',
    surface: 'bg-gray-50'
  },
  dark: {
    bg: 'bg-gray-900',
    text: 'text-gray-100',
    accent: 'text-gray-400',
    border: 'border-gray-800',
    surface: 'bg-gray-800'
  },
  sepia: {
    bg: 'bg-amber-50',
    text: 'text-amber-900',
    accent: 'text-amber-700',
    border: 'border-amber-200',
    surface: 'bg-amber-100'
  }
}

// Font sizes
const fontSizes = {
  small: 'text-sm leading-6',
  medium: 'text-base leading-7',
  large: 'text-lg leading-8',
  xlarge: 'text-xl leading-9'
}

export function ArticleReader({ article, isOpen, onClose }: ArticleReaderProps) {
  // Reading preferences
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light')
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium')
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  // Content state
  const [enhancedContent, setEnhancedContent] = useState<string | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)
  const [autoExtractAttempted, setAutoExtractAttempted] = useState(false)
  
  // Reading progress
  const [readingProgress, setReadingProgress] = useState(0)
  const [readingTime, setReadingTime] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  
  // Refs
  const contentRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<HTMLDivElement>(null)
  
  // Touch handling for mobile gestures
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  // Initialize reading session
  useEffect(() => {
    if (article && isOpen) {
      setStartTime(Date.now())
      setReadingProgress(0)
      setEnhancedContent(null)
      setContentError(null)
      setIsLoadingContent(false)
      setAutoExtractAttempted(false)
    }
  }, [article?.id, isOpen])

  // Auto-extract content if needed
  useEffect(() => {
    if (article && !autoExtractAttempted && shouldAutoExtract(article)) {
      setAutoExtractAttempted(true)
      fetchFullContent(true)
    }
  }, [article, autoExtractAttempted])

  // Reading progress tracking
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return
      
      const element = contentRef.current
      const scrollTop = element.scrollTop
      const scrollHeight = element.scrollHeight - element.clientHeight
      const progress = Math.min((scrollTop / scrollHeight) * 100, 100)
      
      setReadingProgress(progress)
    }

    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener('scroll', handleScroll)
      return () => contentElement.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Reading time tracking
  useEffect(() => {
    if (!startTime || !isOpen) return
    
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      setReadingTime(elapsed)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [startTime, isOpen])

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isLeftSwipe = distanceX > 50 && Math.abs(distanceY) < 100
    const isRightSwipe = distanceX < -50 && Math.abs(distanceY) < 100
    
    if (isLeftSwipe) {
      // Could implement next article navigation
    }
    if (isRightSwipe) {
      onClose()
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'f':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            // Could implement find functionality
          }
          break
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            increaseFontSize()
          }
          break
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            decreaseFontSize()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [isOpen])

  const shouldAutoExtract = (article: Article) => {
    const content = article.content || article.description || article.snippet || ''
    return content.length < 500 // Auto-extract if content is short
  }

  const fetchFullContent = async (auto = false) => {
    if (!article || isLoadingContent) return
    
    setIsLoadingContent(true)
    setContentError(null)
    
    try {
      const response = await fetch('/api/extract-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.url })
      })
      
      const result = await response.json()
      
      if (result.success && result.content) {
        setEnhancedContent(result.content)
      } else {
        if (!auto) {
          setContentError(result.error || 'Failed to extract content')
        }
      }
    } catch (error) {
      if (!auto) {
        setContentError('Network error while extracting content')
      }
    } finally {
      setIsLoadingContent(false)
    }
  }

  const increaseFontSize = () => {
    const sizes = ['small', 'medium', 'large', 'xlarge'] as const
    const currentIndex = sizes.indexOf(fontSize)
    if (currentIndex < sizes.length - 1) {
      setFontSize(sizes[currentIndex + 1])
    }
  }

  const decreaseFontSize = () => {
    const sizes = ['small', 'medium', 'large', 'xlarge'] as const
    const currentIndex = sizes.indexOf(fontSize)
    if (currentIndex > 0) {
      setFontSize(sizes[currentIndex - 1])
    }
  }

  const handleShare = async () => {
    if (!article) return
    
    const shareData = {
      title: article.title,
      text: article.description || article.snippet || '',
      url: article.url
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(article.url)
      // Could show a toast notification here
    }
  }

  const getDisplayContent = () => {
    if (enhancedContent) {
      return enhancedContent
    }
    
    // Use the best available content
    return article?.content || article?.description || article?.snippet || ''
  }

  const formatReadingTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const estimateReadingTime = (content: string) => {
    const wordsPerMinute = 200
    const words = content.split(' ').length
    const minutes = Math.ceil(words / wordsPerMinute)
    return `${minutes} min read`
  }

  const currentTheme = themes[theme]
  const currentFontSize = fontSizes[fontSize]

  if (!article || !isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div 
        className={`h-full ${currentTheme.bg} flex flex-col`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        ref={readerRef}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${currentTheme.border} ${currentTheme.bg}`}>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className={`${currentTheme.text} hover:${currentTheme.surface}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              {article.source_name && (
                <span className={`text-sm font-medium ${currentTheme.accent}`}>
                  {article.source_name}
                </span>
              )}
              {readingTime > 0 && (
                <>
                  <span className={`text-sm ${currentTheme.accent}`}>•</span>
                  <span className={`text-sm ${currentTheme.accent}`}>
                    {formatReadingTime(readingTime)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Font size controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={decreaseFontSize}
              disabled={fontSize === 'small'}
              className={`${currentTheme.text} hover:${currentTheme.surface}`}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={increaseFontSize}
              disabled={fontSize === 'xlarge'}
              className={`${currentTheme.text} hover:${currentTheme.surface}`}
            >
              <Plus className="w-4 h-4" />
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const themes = ['light', 'dark', 'sepia'] as const
                const currentIndex = themes.indexOf(theme)
                const nextIndex = (currentIndex + 1) % themes.length
                setTheme(themes[nextIndex])
              }}
              className={`${currentTheme.text} hover:${currentTheme.surface}`}
            >
              {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Extract content */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchFullContent(false)}
              disabled={isLoadingContent}
              className={`${currentTheme.text} hover:${currentTheme.surface}`}
            >
              <Sparkles className={`w-4 h-4 ${isLoadingContent ? 'animate-spin' : ''}`} />
            </Button>

            {/* Share */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className={`${currentTheme.text} hover:${currentTheme.surface}`}
            >
              <Share2 className="w-4 h-4" />
            </Button>

            {/* External link */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(article.url, '_blank')}
              className={`${currentTheme.text} hover:${currentTheme.surface}`}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Reading progress */}
        <div className={`h-1 ${currentTheme.surface}`}>
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {/* Content */}
        <div 
          ref={contentRef}
          className={`flex-1 overflow-y-auto px-8 py-6 ${currentTheme.bg}`}
        >
          <div className="max-w-4xl mx-auto">
            {/* Article Header */}
            <div className="mb-8 pb-6 border-b border-gray-200 dark:border-gray-700">
              <h1 className={`text-3xl font-bold mb-4 ${currentTheme.text} ${currentFontSize}`}>
                {article.title}
              </h1>
              
              <div className={`flex items-center gap-4 text-sm ${currentTheme.accent}`}>
                {article.author && (
                  <span>By {article.author}</span>
                )}
                {(article.publishedAt || article.published_at) && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(article.publishedAt || article.published_at!).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                )}
                {(article.readTime || article.read_time) && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{article.readTime || article.read_time} read</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Enhanced Article Content */}
            <EnhancedArticleContent
              content={getDisplayContent()}
              baseUrl={article.url}
              className={`${currentFontSize} ${currentTheme.text}`}
            />

            {/* Content extraction status */}
            {contentError && (
              <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-300 text-sm">
                  {contentError}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchFullContent(false)}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Additional styles for the article content
export const articleReaderStyles = `
  .prose {
    @apply text-gray-900 dark:text-gray-100;
  }

  .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
    @apply text-gray-900 dark:text-gray-100 font-semibold;
  }

  .prose h1 {
    @apply text-2xl mb-4 mt-8 first:mt-0;
  }

  .prose h2 {
    @apply text-xl mb-3 mt-6 first:mt-0;
  }

  .prose h3 {
    @apply text-lg mb-2 mt-4 first:mt-0;
  }

  .prose p {
    @apply mb-4 leading-relaxed;
  }

  .prose ul, .prose ol {
    @apply mb-4 pl-6;
  }

  .prose li {
    @apply mb-1;
  }

  .prose img {
    @apply rounded-lg shadow-sm my-6;
  }

  .prose table {
    @apply w-full border-collapse border border-gray-300 dark:border-gray-600 my-6;
  }

  .prose th, .prose td {
    @apply border border-gray-300 dark:border-gray-600 px-4 py-2 text-left;
  }

  .prose th {
    @apply bg-gray-100 dark:bg-gray-800 font-semibold;
  }
` 