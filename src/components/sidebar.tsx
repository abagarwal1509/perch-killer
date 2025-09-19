'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { 
  Home, Plus, Users, Settings, LogOut, Search, BookOpen, 
  Link as LinkIcon, Rss, RefreshCw, X, AlertCircle, CheckCircle,
  Loader2, Compass, User, ChevronDown
} from 'lucide-react'
import { Button } from './ui/button'
import { createSupabaseClient } from '@/lib/supabase'
import { DatabaseService } from '@/lib/database'
import { RefreshService, type RefreshProgress } from '@/lib/refresh-service'
import { QuickRefreshService, type QuickRefreshProgress } from '@/lib/quick-refresh-service'
import { cn } from '@/lib/utils'
import { RSSParser } from '@/lib/rss-parser'

interface SidebarProps {
  user: any
}

const navigationItems = [
  {
    name: 'New Source',
    icon: Plus,
    href: '#',
    action: 'new-source'
  },
  {
    name: 'Discover',
    icon: Compass,
    href: '/dashboard',
    action: null
  },
  {
    name: 'Authors',
    icon: Users,
    href: '/dashboard/authors',
    action: null
  },
  {
    name: 'Connect',
    icon: LinkIcon,
    href: '/dashboard/connect',
    action: null
  },
  {
    name: 'Quick Refresh All',
    icon: RefreshCw,
    href: '#',
    action: 'quick-refresh-all'
  },
]

export function Sidebar({ user }: SidebarProps) {
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showNewSourceModal, setShowNewSourceModal] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0, currentSource: '' })
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createSupabaseClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleNavigation = (item: any) => {
    if (item.action === 'new-source') {
      setShowNewSourceModal(true)
      setError('')
      setSuccess('')
      setNewUrl('')
    } else if (item.action === 'quick-refresh-all') {
      setShowConfirmDialog(true)
    } else if (item.action === 'archive-refresh-all') {
      handleRefreshAll()
    } else {
      router.push(item.href)
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
      const db = new DatabaseService()
      
      // Parse the RSS feed to validate and get info
      const parsedFeed = await RSSParser.fetchAndParse(newUrl.trim())
      
      // Use the discovered feed URL or the original URL
      const feedUrl = parsedFeed.feedUrl || newUrl.trim()
      
      // Save to database
      await db.addSource({
        name: parsedFeed.title || 'Unknown Blog',
        url: feedUrl,
        description: parsedFeed.description || 'Recently added blog source',
        status: 'active',
        last_fetched_at: new Date().toISOString(),
        articles_count: parsedFeed.items.length
      })
      
      // Show success message with discovered feed info
      const feedInfo = parsedFeed.feedUrl && parsedFeed.feedUrl !== newUrl.trim() 
        ? ` (found feed at ${parsedFeed.feedUrl})`
        : ''
      setSuccess(`Successfully added "${parsedFeed.title}" with ${parsedFeed.items.length} articles!${feedInfo}`)
      
      // Clear form after 2 seconds and close modal
      setTimeout(() => {
        setNewUrl('')
        setShowNewSourceModal(false)
        setSuccess('')
        // Redirect to Connect page to see the new source
        router.push('/dashboard/connect')
      }, 2000)
      
    } catch (error) {
      console.error('Error adding RSS source:', error)
      setError(error instanceof Error ? error.message : 'Failed to add source. Please check the URL and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseModal = () => {
    if (!loading) {
      setShowNewSourceModal(false)
      setNewUrl('')
      setError('')
      setSuccess('')
    }
  }

  const handleRefreshAll = async () => {
    setRefreshing(true)
    
    try {
      const result = await RefreshService.refreshAllSources((progress) => {
        setRefreshProgress(progress)
      })
      
      if (result.success) {
        console.log('🎉 All sources refreshed successfully!')
      } else {
        console.error('❌ Some sources failed to refresh:', result.errors)
      }
      
      // Trigger page refresh to show updated data
      if (pathname === '/dashboard' || pathname === '/dashboard/connect') {
        // Small delay to allow final progress update
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
      
    } catch (error) {
      console.error('Error during refresh all:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleQuickRefreshAll = async () => {
    const controller = new AbortController()
    setAbortController(controller)
    setShowConfirmDialog(false)
    setShowProgressModal(true)
    setRefreshProgress({ current: 0, total: 0, currentSource: '' })
    
    try {
      const db = new DatabaseService()
      const sources = await db.getSources()
      
      setRefreshProgress({ current: 0, total: sources.length, currentSource: 'Starting...' })
      
      for (let i = 0; i < sources.length; i++) {
        if (controller.signal.aborted) {
          console.log('🛑 Quick refresh cancelled by user')
          break
        }
        
        const source = sources[i]
        setRefreshProgress({ current: i + 1, total: sources.length, currentSource: source.name })
        
        try {
          const articlesAdded = await QuickRefreshService.quickRefreshSource(source.id, source.url, source.name)
          console.log(`✅ Refreshed: ${source.name} (${articlesAdded} articles)`)
        } catch (error) {
          console.error(`❌ Failed to refresh ${source.name}:`, error)
        }
      }
      
      if (!controller.signal.aborted) {
        console.log('⚡ All sources quick refreshed successfully!')
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } catch (error) {
      console.error('❌ Quick refresh all failed:', error)
    } finally {
      setShowProgressModal(false)
      setAbortController(null)
    }
  }

  const handleStopRefresh = () => {
    if (abortController) {
      abortController.abort()
      setShowProgressModal(false)
      setAbortController(null)
    }
  }

  return (
    <>
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-semibold text-sidebar-foreground">BlogHub</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = item.href === pathname
              const isArchiveRefreshing = item.action === 'archive-refresh-all' && refreshing
              const isQuickRefreshing = item.action === 'quick-refresh-all' && showProgressModal
              const isCurrentlyRefreshing = isArchiveRefreshing || isQuickRefreshing
              
              let progressText = item.name
              let statusIcon = null
              
              if (isQuickRefreshing && refreshProgress.total > 0) {
                progressText = `${refreshProgress.current}/${refreshProgress.total} sources`
                statusIcon = <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              }

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item)}
                  disabled={isCurrentlyRefreshing}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    pathname === item.href ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300",
                    isCurrentlyRefreshing && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className={cn("w-5 h-5", isCurrentlyRefreshing && "animate-spin")} />
                  <span className="flex-1 truncate">
                    {isCurrentlyRefreshing ? (
                      <span className="text-sm">
                        {progressText}
                      </span>
                    ) : (
                      item.name
                    )}
                  </span>
                  {statusIcon}
                </button>
              )
            })}
          </div>
        </nav>

        {/* User Account */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors hover:bg-sidebar-accent/50"
            >
              <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sidebar-foreground truncate">
                  {user?.email || 'User'}
                </p>
              </div>
              <ChevronDown className={cn(
                "w-4 h-4 text-sidebar-foreground transition-transform",
                showAccountMenu && "rotate-180"
              )} />
            </button>

            {showAccountMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-sidebar border border-sidebar-border rounded-lg shadow-lg overflow-hidden">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* New Source Modal */}
      {showNewSourceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Add New Source</h2>
              <button
                onClick={handleCloseModal}
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
                  onClick={handleCloseModal}
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

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Quick Refresh All Sources</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to refresh all sources? This will fetch the latest articles from all your connected sources.
            </p>
            <div className="flex space-x-3">
              <Button 
                onClick={() => setShowConfirmDialog(false)}
                variant="outline" 
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleQuickRefreshAll}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Quick Refreshing Sources</h3>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                <span>Progress</span>
                <span>{refreshProgress.current}/{refreshProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${refreshProgress.total > 0 ? (refreshProgress.current / refreshProgress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Currently refreshing: <span className="font-medium">{refreshProgress.currentSource}</span>
              </p>
            </div>

            <Button 
              onClick={handleStopRefresh}
              variant="outline"
              className="w-full"
            >
              <X className="w-4 h-4 mr-2" />
              Stop Process
            </Button>
          </div>
        </div>
      )}
    </>
  )
} 