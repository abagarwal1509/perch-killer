'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  X, ExternalLink, Share2, Bookmark, Clock, Calendar, Download, 
  Sparkles, Sun, Moon, Type, Minus, Plus, MoreHorizontal, 
  ArrowLeft, Heart, MessageSquare, Repeat, Settings 
} from 'lucide-react'

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

// Get real article content from the database
const getFullContent = (article: Article) => {
  // Use the actual content if available, otherwise fall back to description
  const content = article.content || article.description || article.snippet || ''
  
  console.log('Article content debug:', {
    title: article.title,
    content: content?.substring(0, 100) + '...',
    contentLength: content?.length,
    hasContent: !!content
  })
  
  if (!content || content.trim().length === 0) {
    return `
      <div class="text-center py-8">
        <p class="text-muted-foreground italic mb-4">
          This article doesn't have full content available in the RSS feed.
        </p>
        <p class="text-muted-foreground mb-4">
          RSS feeds typically only provide article summaries. To read the complete article, please visit the original source.
        </p>
        <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
          Read Full Article on Original Site
        </a>
      </div>
    `
  }
  
  // Clean and format the content
  let formattedContent = content
  
  // If content already has HTML tags, use it as-is
  if (formattedContent.includes('<') && formattedContent.includes('>')) {
    return formattedContent
  }
  
  // Otherwise, format plain text into paragraphs
  formattedContent = formattedContent
    .split(/\n\s*\n/)  // Split on double newlines or empty lines
    .map(paragraph => paragraph.trim())
    .filter(paragraph => paragraph.length > 0)
    .map(paragraph => `<p class="mb-4">${paragraph}</p>`)
    .join('\n')
  
  return formattedContent || `
    <div class="text-center py-8">
      <p class="text-muted-foreground italic mb-4">
        Content formatting failed. 
      </p>
      <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="text-primary underline">
        Read the original article here
      </a>
    </div>
  `
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
    if (!isOpen || !contentRef.current) return

    const handleScroll = () => {
      const element = contentRef.current
      if (!element) return

      const scrollTop = element.scrollTop
      const scrollHeight = element.scrollHeight - element.clientHeight
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0
      
      setReadingProgress(Math.min(100, Math.max(0, progress)))
    }

    const element = contentRef.current
    element.addEventListener('scroll', handleScroll)
    return () => element.removeEventListener('scroll', handleScroll)
  }, [isOpen, enhancedContent])

  // Reading time tracking
  useEffect(() => {
    if (!isOpen || !startTime) return

    const interval = setInterval(() => {
      setReadingTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isOpen, startTime])

  // Touch gesture handling
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.touches[0].clientX, y: e.touches[0].clientY })
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const deltaX = touchEnd.x - touchStart.x
    const deltaY = touchEnd.y - touchStart.y
    
    // Swipe right to close (if swipe is more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 100) {
      onClose()
    }
    
    setTouchStart(null)
    setTouchEnd(null)
  }

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('reader-theme') as 'light' | 'dark' | 'sepia'
    const savedFontSize = localStorage.getItem('reader-font-size') as 'small' | 'medium' | 'large' | 'xlarge'
    
    if (savedTheme) setTheme(savedTheme)
    if (savedFontSize) setFontSize(savedFontSize)
  }, [])

  useEffect(() => {
    localStorage.setItem('reader-theme', theme)
    localStorage.setItem('reader-font-size', fontSize)
  }, [theme, fontSize])

  if (!isOpen || !article) return null

  const shouldAutoExtract = (article: Article): boolean => {
    const content = article.content || article.description || ''
    return (
      content.length < 300 || 
      content.includes('...') || 
      content.endsWith('Read more') || 
      content.split(' ').length < 50
    )
  }

  const fetchFullContent = async (isAutoExtract = false) => {
    setIsLoadingContent(true)
    setContentError(null)
    
    try {
      const response = await fetch('/api/extract-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: article.url }),
      })
      
      const result = await response.json()
      
      if (result.success && result.content) {
        setEnhancedContent(result.content)
        
        // Store enhanced content
        try {
          await fetch('/api/update-article-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              articleId: article.id, 
              content: result.content 
            })
          })
        } catch (e) {
          console.log('Failed to save enhanced content:', e)
        }
      } else {
        setContentError(result.error || 'Failed to extract content')
      }
    } catch (error) {
      console.error('Content extraction error:', error)
      setContentError('Network error - please try again')
    } finally {
      setIsLoadingContent(false)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          text: article.snippet || article.description,
          url: article.url,
        })
      } catch (err) {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(article.url)
      // Could show a toast notification here
    }
  }

  const getDisplayContent = () => {
    if (enhancedContent) return enhancedContent
    
    const originalContent = article.content || article.description || article.snippet || ''
    
    if (originalContent.length < 200) return null
    
    // Process regular content to improve formatting
    let processedContent = originalContent
    
    // Handle HTML content
    if (processedContent.includes('<') && processedContent.includes('>')) {
      // Convert HTML to text for better processing
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = processedContent
      processedContent = tempDiv.textContent || tempDiv.innerText || ''
    }
    
    // Clean up common formatting issues
    processedContent = processedContent
      // Fix multiple spaces
      .replace(/\s+/g, ' ')
      // Fix common encoding issues
      .replace(/&#8217;/g, "'")
      .replace(/&#8220;/g, '"')
      .replace(/&#8221;/g, '"')
      .replace(/&#8211;/g, '–')
      .replace(/&#8212;/g, '—')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' ')
      // Fix weird spacing patterns
      .replace(/\.\s*\.\s*\./g, '...')
      .replace(/\s*\n\s*/g, '\n')
      .trim()
    
    // Split into paragraphs and format
    const paragraphs = processedContent
      .split(/\n\s*\n|\r\n\s*\r\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
    
    // If we have multiple paragraphs, format them properly
    if (paragraphs.length > 1) {
      processedContent = paragraphs.join('\n\n')
    }
    
    // Handle bullet points and lists that might be formatted differently
    processedContent = processedContent
      .replace(/^\s*[\*\-\+]\s+/gm, '• ')
      .replace(/^\s*\d+\.\s+/gm, (match) => match.replace(/^\s*(\d+)\.\s+/, '$1. '))
      
    return processedContent
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

  const renderEnhancedContent = (content: string) => {
    // Split content into lines and process each one
    const lines = content.split('\n')
    const processedElements = []
    let currentList = []
    let currentListType = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Skip empty lines but preserve spacing
      if (!line) {
        if (currentList.length > 0) {
          // Close current list
          processedElements.push(
            <ul key={`list-${i}`} className="list-disc pl-6 mb-6 space-y-2">
              {currentList.map((item, idx) => (
                <li key={idx} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          )
          currentList = []
          currentListType = null
        }
        continue
      }
      
      // Handle YouTube embeds
      if (line.startsWith('[YOUTUBE: ')) {
        const urlMatch = line.match(/\[YOUTUBE: ([^\]]+)\]/)
        if (urlMatch) {
          const url = urlMatch[1]
          const videoIdMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
          if (videoIdMatch) {
            const videoId = videoIdMatch[1]
            processedElements.push(
              <div key={i} className="my-8">
                <div className="aspect-video rounded-lg overflow-hidden bg-black shadow-lg">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  ></iframe>
                </div>
              </div>
            )
          }
        }
        continue
      }
      
      // Handle images
      if (line.startsWith('[IMAGE: ')) {
        const imageMatch = line.match(/\[IMAGE: ([^|]+)(?:\s*\|\s*Alt: ([^\]]*))?\]/)
        if (imageMatch) {
          const src = imageMatch[1].trim()
          const alt = imageMatch[2] || ''
          processedElements.push(
            <div key={i} className="my-8">
              <img
                src={src}
                alt={alt}
                className="w-full rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              {alt && (
                <p className={`text-sm ${currentTheme.accent} text-center mt-3 italic`}>
                  {alt}
                </p>
              )}
            </div>
          )
        }
        continue
      }
      
      // Handle headings
      if (line.startsWith('### ')) {
        processedElements.push(
          <h3 key={i} className="text-xl md:text-2xl font-semibold mt-8 mb-4 leading-tight">
            {line.replace('### ', '')}
          </h3>
        )
        continue
      }
      if (line.startsWith('## ')) {
        processedElements.push(
          <h2 key={i} className="text-2xl md:text-3xl font-semibold mt-8 mb-4 leading-tight">
            {line.replace('## ', '')}
          </h2>
        )
        continue
      }
      if (line.startsWith('# ')) {
        processedElements.push(
          <h1 key={i} className="text-3xl md:text-4xl font-bold mt-8 mb-6 leading-tight">
            {line.replace('# ', '')}
          </h1>
        )
        continue
      }
      
      // Handle blockquotes
      if (line.startsWith('> ')) {
        processedElements.push(
          <blockquote key={i} className={`border-l-4 border-blue-500 pl-6 ml-0 mr-0 my-6 italic ${currentTheme.surface} py-4 pr-4 rounded-r-lg`}>
            <p className="mb-0">{line.replace('> ', '')}</p>
          </blockquote>
        )
        continue
      }
      
      // Handle list items
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        if (currentListType !== 'bullet') {
          // Close previous list if different type
          if (currentList.length > 0) {
            processedElements.push(
              <ul key={`list-${i}-prev`} className="list-disc pl-6 mb-6 space-y-2">
                {currentList.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            )
          }
          currentList = []
          currentListType = 'bullet'
        }
        currentList.push(line.replace(/^[•\-\*] /, ''))
        continue
      }
      
      // Handle numbered list items
      if (/^\d+\.\s/.test(line)) {
        if (currentListType !== 'numbered') {
          // Close previous list if different type
          if (currentList.length > 0) {
            processedElements.push(
              <ul key={`list-${i}-prev`} className="list-disc pl-6 mb-6 space-y-2">
                {currentList.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            )
          }
          currentList = []
          currentListType = 'numbered'
        }
        currentList.push(line.replace(/^\d+\.\s/, ''))
        continue
      }
      
      // Close any open list before handling other content
      if (currentList.length > 0) {
        const ListComponent = currentListType === 'numbered' ? 'ol' : 'ul'
        const listClass = currentListType === 'numbered' ? 'list-decimal pl-6 mb-6 space-y-2' : 'list-disc pl-6 mb-6 space-y-2'
        
        processedElements.push(
          React.createElement(ListComponent, {
            key: `list-${i}`,
            className: listClass
          }, currentList.map((item, idx) => (
            React.createElement('li', {
              key: idx,
              className: 'leading-relaxed'
            }, item)
          )))
        )
        currentList = []
        currentListType = null
      }
      
      // Handle code blocks
      if (line.startsWith('```')) {
        processedElements.push(
          <pre key={i} className={`${currentTheme.surface} p-4 rounded-lg overflow-x-auto my-6 text-sm`}>
            <code>{line.replace(/```/g, '')}</code>
          </pre>
        )
        continue
      }
      
      // Handle horizontal rules
      if (line === '---' || line === '___') {
        processedElements.push(
          <hr key={i} className={`my-8 border-t ${currentTheme.border}`} />
        )
        continue
      }
      
      // Handle regular paragraphs with formatting
      if (line) {
        let formattedText = line
        
        // Handle bold and italic formatting
        if (formattedText.includes('**') || formattedText.includes('*')) {
          formattedText = formattedText
            .replace(/\*\*\*\*(.*?)\*\*\*\*/g, '<strong>$1</strong>') // Handle ****text****
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>') // Handle ***text***
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Handle **text**
            .replace(/\*(.*?)\*/g, '<em>$1</em>') // Handle *text*
        }
        
        // Handle inline code
        if (formattedText.includes('`')) {
          formattedText = formattedText.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">$1</code>')
        }
        
        if (formattedText.includes('<')) {
          processedElements.push(
            <p 
              key={i} 
              className="mb-6 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formattedText }}
            />
          )
        } else {
          processedElements.push(
            <p key={i} className="mb-6 leading-relaxed">
              {formattedText}
            </p>
          )
        }
      }
    }
    
    // Close any remaining list
    if (currentList.length > 0) {
      const ListComponent = currentListType === 'numbered' ? 'ol' : 'ul'
      const listClass = currentListType === 'numbered' ? 'list-decimal pl-6 mb-6 space-y-2' : 'list-disc pl-6 mb-6 space-y-2'
      
      processedElements.push(
        React.createElement(ListComponent, {
          key: `list-final`,
          className: listClass
        }, currentList.map((item, idx) => (
          React.createElement('li', {
            key: idx,
            className: 'leading-relaxed'
          }, item)
        )))
      )
    }
    
    return processedElements
  }

  const displayContent = getDisplayContent()
  const currentTheme = themes[theme]
  const currentFontSize = fontSizes[fontSize]

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col transition-all duration-300 ${currentTheme.bg}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      ref={readerRef}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 z-10">
        <div 
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${currentTheme.border} bg-opacity-80 backdrop-blur-md sticky top-0 z-10`}>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex flex-col">
            <span className={`text-sm font-medium ${currentTheme.text}`}>
              {article.source_name || article.blog || 'Article'}
            </span>
            <span className={`text-xs ${currentTheme.accent}`}>
              {readingTime > 0 && `${formatReadingTime(readingTime)} • `}
              {Math.round(readingProgress)}% complete
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Settings className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={`${currentTheme.surface} border-b ${currentTheme.border} p-4 transition-all duration-300`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${currentTheme.text}`}>Reading Settings</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(false)}
              className="p-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Theme selector */}
            <div>
              <label className={`text-xs font-medium ${currentTheme.accent} mb-2 block`}>Theme</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setTheme('light')}
                  className={`p-2 rounded-full border-2 ${theme === 'light' ? 'border-blue-500' : 'border-gray-300'}`}
                >
                  <Sun className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-2 rounded-full border-2 ${theme === 'dark' ? 'border-blue-500' : 'border-gray-300'}`}
                >
                  <Moon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setTheme('sepia')}
                  className={`p-2 rounded-full border-2 ${theme === 'sepia' ? 'border-blue-500' : 'border-gray-300'}`}
                >
                  <Type className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Font size selector */}
            <div>
              <label className={`text-xs font-medium ${currentTheme.accent} mb-2 block`}>Font Size</label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFontSize(fontSize === 'xlarge' ? 'xlarge' : 
                    fontSize === 'large' ? 'medium' : 
                    fontSize === 'medium' ? 'small' : 'small')}
                  className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className={`text-sm ${currentTheme.text} min-w-[3rem] text-center`}>
                  {fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}
                </span>
                <button
                  onClick={() => setFontSize(fontSize === 'small' ? 'medium' : 
                    fontSize === 'medium' ? 'large' : 
                    fontSize === 'large' ? 'xlarge' : 'xlarge')}
                  className="p-2 rounded-full border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-12 scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="max-w-2xl mx-auto">
          {/* Article header */}
          <div className="mb-8">
            <h1 className={`text-3xl md:text-4xl font-bold mb-4 leading-tight ${currentTheme.text}`}>
              {article.title}
            </h1>
            
            <div className="flex items-center flex-wrap gap-4 mb-6">
              {article.author && (
                <span className={`text-sm ${currentTheme.accent}`}>
                  by {article.author}
                </span>
              )}
              
              {(article.publishedAt || article.published_at || article.publishedDate) && (
                <span className={`text-sm ${currentTheme.accent} flex items-center`}>
                  <Calendar className="h-4 w-4 mr-1" />
                  {new Date(article.publishedAt || article.published_at || article.publishedDate || '').toLocaleDateString()}
                </span>
              )}
              
              {displayContent && (
                <span className={`text-sm ${currentTheme.accent} flex items-center`}>
                  <Clock className="h-4 w-4 mr-1" />
                  {estimateReadingTime(displayContent)}
                </span>
              )}
            </div>
          </div>

          {/* Enhanced content badge */}
          {enhancedContent && (
            <div className="mb-6 flex items-center justify-center">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <Sparkles className="h-4 w-4 mr-1" />
                Enhanced Content
              </div>
            </div>
          )}

          {/* Content */}
          <article className={`prose prose-lg max-w-none ${currentFontSize} ${currentTheme.text}`}>
            {isLoadingContent && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className={`${currentTheme.accent}`}>Extracting full content...</p>
              </div>
            )}

            {contentError && (
              <div className="text-center py-12 px-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-red-600 dark:text-red-400 mb-4">{contentError}</p>
                <Button
                  onClick={() => fetchFullContent(false)}
                  variant="outline"
                  size="sm"
                >
                  Try Again
                </Button>
              </div>
            )}

            {displayContent ? (
              // Always use enhanced formatting for better structure
              <div className="space-y-4">
                <div className="prose-content">
                  {renderEnhancedContent(enhancedContent || displayContent)}
                </div>
              </div>
            ) : !isLoadingContent && (
              <div className="text-center py-12 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className={`${currentTheme.accent} mb-4`}>
                  This article only has a preview available. Would you like to extract the full content?
                </p>
                <Button
                  onClick={() => fetchFullContent(false)}
                  className="mr-3"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Full Content
                </Button>
                <Button
                  onClick={() => window.open(article.url, '_blank')}
                  variant="outline"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Read Original
                </Button>
              </div>
            )}
          </article>
        </div>
      </div>

      {/* Action bar */}
      <div className={`flex items-center justify-between p-4 border-t ${currentTheme.border} bg-opacity-80 backdrop-blur-md`}>
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-red-500 hover:text-red-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            <Heart className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

        <Button
          onClick={() => window.open(article.url, '_blank')}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Original</span>
        </Button>
      </div>
    </div>
  )
}

// Additional styles for the article content
export const articleReaderStyles = `
  .article-content {
    line-height: 1.7;
    color: var(--foreground);
  }
  
  .article-content .lead {
    font-size: 1.25rem;
    font-weight: 400;
    margin-bottom: 2rem;
    color: var(--muted-foreground);
  }
  
  .article-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-top: 2.5rem;
    margin-bottom: 1rem;
    color: var(--foreground);
  }
  
  .article-content p {
    margin-bottom: 1.5rem;
    color: var(--foreground);
  }
  
  .article-content blockquote {
    font-style: italic;
    padding-left: 1rem;
    border-left: 4px solid var(--primary);
    margin: 1.5rem 0;
    color: var(--muted-foreground);
  }
  
  .article-content ul {
    margin: 1rem 0;
    padding-left: 1.5rem;
  }
  
  /* Enhanced content styles */
  .prose-enhanced {
    max-width: none;
    color: var(--foreground);
  }
  
  .prose-enhanced p {
    font-size: 1.1rem;
    line-height: 1.8;
    margin-bottom: 1.5rem;
    color: var(--foreground);
  }
  
  .prose-enhanced h2 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-top: 3rem;
    margin-bottom: 1.5rem;
    color: var(--foreground);
    border-bottom: 2px solid var(--border);
    padding-bottom: 0.5rem;
  }
  
  .prose-enhanced blockquote {
    font-size: 1.1rem;
    font-style: italic;
    padding: 1.5rem;
    margin: 2rem 0;
    background: var(--muted);
    border-left: 4px solid var(--primary);
    border-radius: 0.5rem;
  }
  
  .prose-enhanced li {
    font-size: 1.1rem;
    line-height: 1.7;
    margin-bottom: 0.5rem;
    list-style-type: disc;
  }
  
  /* Enhanced media styles */
  .prose-enhanced iframe {
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  .prose-enhanced img {
    transition: all 0.3s ease;
  }
  
  .prose-enhanced img:hover {
    transform: scale(1.02);
    box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.1);
  }
  
  /* Rich text formatting */
  .prose-enhanced strong {
    font-weight: 700;
    color: var(--foreground);
  }
  
  .prose-enhanced em {
    font-style: italic;
    color: var(--muted-foreground);
  }
  
  /* Media loading states */
  .media-placeholder {
    background: var(--muted);
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    color: var(--muted-foreground);
  }
  
  .article-content li {
    margin-bottom: 0.5rem;
    color: var(--foreground);
  }
` 