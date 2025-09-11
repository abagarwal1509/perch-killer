'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { 
  Plus, 
  Compass, 
  Link as LinkIcon, 
  User,
  LogOut,
  ChevronDown,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { RSSParser } from '@/lib/rss-parser'
import { DatabaseService } from '@/lib/database'

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
    icon: User,
    href: '/dashboard/authors',
    action: null
  },
  {
    name: 'Connect',
    icon: LinkIcon,
    href: '/dashboard/connect',
    action: null
  },
]

export function Sidebar({ user }: SidebarProps) {
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showNewSourceModal, setShowNewSourceModal] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
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

  return (
    <>
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-full flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-semibold text-sidebar-foreground">Perch Killer</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = item.href === pathname
              
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item)}
                  className={cn(
                    "w-full flex items-center space-x-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
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
    </>
  )
} 