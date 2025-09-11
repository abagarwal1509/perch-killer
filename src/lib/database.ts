import { createSupabaseClient } from './supabase'

export interface Author {
  id: number
  user_id: string
  name: string
  slug: string
  bio?: string
  avatar_url?: string
  primary_source_url?: string
  twitter_handle?: string
  linkedin_url?: string
  website_url?: string
  key_topics?: string[]
  writing_style_summary?: string
  position_tracking?: Record<string, any>
  content_stats?: Record<string, any>
  last_analyzed_at?: string
  articles_count: number
  is_featured: boolean
  created_at: string
  updated_at: string
}

export interface AuthorEvolution {
  id: number
  author_id: number
  article_id: number
  topic: string
  previous_position?: string
  current_position?: string
  confidence_score: number
  evolution_type: 'contradiction' | 'refinement' | 'expansion' | 'reversal'
  supporting_quotes?: string[]
  created_at: string
}

export interface Source {
  id: number
  user_id: string
  author_id?: number
  name: string
  url: string
  description?: string
  status: 'active' | 'error' | 'paused'
  last_fetched_at?: string
  articles_count: number
  created_at: string
  updated_at: string
}

export interface Article {
  id: number
  source_id: number
  user_id: string
  author_id?: number
  title: string
  description?: string
  content?: string
  url: string
  author?: string
  published_at?: string
  image_url?: string
  categories?: string[]
  read_time?: string
  is_read: boolean
  is_bookmarked: boolean
  is_enhanced: boolean
  content_length: number
  ai_analysis?: Record<string, any>
  key_quotes?: string[]
  main_themes?: string[]
  contradicts_previous: boolean
  related_article_ids?: number[]
  created_at: string
  updated_at: string
}

export interface ArticleWithSource extends Article {
  source_name: string
  source_url: string
}

export class DatabaseService {
  public supabase = createSupabaseClient()

  // Sources CRUD operations
  async getSources(): Promise<Source[]> {
    const { data, error } = await this.supabase
      .from('sources')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sources:', error)
      throw new Error('Failed to fetch sources')
    }

    return data || []
  }

  async addSource(source: Omit<Source, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Source> {
    // Get authenticated user
    const { data: { user }, error: userError } = await this.supabase.auth.getUser()
    const { data: { session }, error: sessionError } = await this.supabase.auth.getSession()
    
    if (!user) {
      console.error('Authentication failed: User not found')
      throw new Error('User not authenticated')
    }
    
    if (!session) {
      console.error('Authentication failed: No active session')
      throw new Error('No active session - please sign in again')
    }

    // Check if source already exists for this user (check for exact URL match first)
    const { data: existingSource } = await this.supabase
      .from('sources')
      .select('id, name, url')
      .eq('user_id', user.id)
      .eq('url', source.url)
      .single()

    if (existingSource) {
      throw new Error(`Source "${existingSource.name}" has already been added to your feed list`)
    }

    // Also check if there's a similar source (same domain) to catch feed URL variations
    const domain = new URL(source.url).hostname
    const { data: similarSources } = await this.supabase
      .from('sources')
      .select('id, name, url')
      .eq('user_id', user.id)
      .like('url', `%${domain}%`)

    if (similarSources && similarSources.length > 0) {
      const matchingSources = similarSources.filter(s => 
        new URL(s.url).hostname === domain
      )
      if (matchingSources.length > 0) {
        const existing = matchingSources[0]
        throw new Error(`A source from ${domain} ("${existing.name}") has already been added to your feed list`)
      }
    }

    // Use the session user ID to ensure consistency with RLS
    const userId = session.user.id
    
    const sourceWithUserId = {
      ...source,
      user_id: userId
    }



    const { data, error } = await this.supabase
      .from('sources')
      .insert(sourceWithUserId)
      .select()
      .single()

    if (error) {
      console.error('Error adding source:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      console.error('Source data:', JSON.stringify(sourceWithUserId, null, 2))
      
      // Handle specific error cases
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
        throw new Error('This source has already been added to your feed list')
      }
      
      if (error.code === '23503') {
        throw new Error('Database constraint violation - please check your authentication')
      }
      
      throw new Error(`Failed to add source: ${error.message || error.code || 'Unknown error'}`)
    }

    return data
  }

  async updateSource(id: number, updates: Partial<Source>): Promise<Source> {
    const { data, error } = await this.supabase
      .from('sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating source:', error)
      throw new Error('Failed to update source')
    }

    return data
  }

  async deleteSource(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('sources')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting source:', error)
      throw new Error('Failed to delete source')
    }
  }

  // Articles CRUD operations
  async getArticles(limit?: number, sourceId?: number): Promise<ArticleWithSource[]> {
    let query = this.supabase
      .from('articles_with_sources')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (sourceId) {
      query = query.eq('source_id', sourceId)
    }

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching articles:', error)
      throw new Error('Failed to fetch articles')
    }

    return data || []
  }

  async addArticle(article: Omit<Article, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Article> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await this.supabase
      .from('articles')
      .insert({
        ...article,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding article:', error)
      throw new Error('Failed to add article')
    }

    return data
  }

  async addArticles(articles: Omit<Article, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]): Promise<Article[]> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const articlesWithUserId = articles.map(article => ({
      ...article,
      user_id: user.id
    }))



    const { data, error } = await this.supabase
      .from('articles')
      .upsert(articlesWithUserId, { 
        onConflict: 'source_id,url',
        ignoreDuplicates: true 
      })
      .select()

    if (error) {
      console.error('Error adding articles:', error)
      throw new Error('Failed to add articles')
    }



    return data || []
  }

  async updateArticle(id: number, updates: Partial<Article>): Promise<Article> {
    const { data, error } = await this.supabase
      .from('articles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating article:', error)
      throw new Error('Failed to update article')
    }

    return data
  }

  async updateArticleContent(id: number, content: string): Promise<void> {
    const { error } = await this.supabase
      .from('articles')
      .update({ 
        content: content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating article content:', error)
      throw new Error('Failed to update article content')
    }
  }

  async markAsRead(id: number): Promise<void> {
    await this.updateArticle(id, { is_read: true })
  }

  async toggleBookmark(id: number, isBookmarked: boolean): Promise<void> {
    await this.updateArticle(id, { is_bookmarked: isBookmarked })
  }

  async getBookmarkedArticles(): Promise<ArticleWithSource[]> {
    const { data, error } = await this.supabase
      .from('articles_with_sources')
      .select('*')
      .eq('is_bookmarked', true)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookmarked articles:', error)
      throw new Error('Failed to fetch bookmarked articles')
    }

    return data || []
  }

  async getUnreadArticles(): Promise<ArticleWithSource[]> {
    const { data, error } = await this.supabase
      .from('articles_with_sources')
      .select('*')
      .eq('is_read', false)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching unread articles:', error)
      throw new Error('Failed to fetch unread articles')
    }

    return data || []
  }

  // Utility functions
  async refreshSourceArticles(sourceId: number): Promise<void> {
    // This function would fetch new articles from the RSS feed
    // and add them to the database
    const source = await this.getSourceById(sourceId)
    if (!source) return

    // Implementation would use RSSParser to fetch and parse articles
    // then call addArticles to store them
  }

  private async getSourceById(id: number): Promise<Source | null> {
    const { data, error } = await this.supabase
      .from('sources')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching source:', error)
      return null
    }

    return data
  }

  // Author CRUD operations
  async getAuthors(): Promise<Author[]> {
    const { data, error } = await this.supabase
      .from('author_profiles')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('articles_count', { ascending: false })

    if (error) {
      console.error('Error fetching authors:', error)
      throw new Error('Failed to fetch authors')
    }

    return data || []
  }

  async getAuthorBySlug(slug: string): Promise<Author | null> {
    const { data, error } = await this.supabase
      .from('authors')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null
      }
      console.error('Error fetching author:', error)
      throw new Error('Failed to fetch author')
    }

    return data
  }

  async addAuthor(author: Omit<Author, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Author> {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await this.supabase
      .from('authors')
      .insert({
        ...author,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding author:', error)
      if (error.code === '23505') {
        throw new Error('An author with this slug already exists')
      }
      throw new Error('Failed to add author')
    }

    return data
  }

  async updateAuthor(id: number, updates: Partial<Author>): Promise<Author> {
    const { data, error } = await this.supabase
      .from('authors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating author:', error)
      throw new Error('Failed to update author')
    }

    return data
  }

  async getAuthorArticles(authorId: number, limit?: number): Promise<ArticleWithSource[]> {
    let query = this.supabase
      .from('articles_with_sources')
      .select('*')
      .eq('author_id', authorId)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (limit) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching author articles:', error)
      throw new Error('Failed to fetch author articles')
    }

    return data || []
  }

  async getAuthorEvolution(authorId: number): Promise<AuthorEvolution[]> {
    const { data, error } = await this.supabase
      .from('author_evolution')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching author evolution:', error)
      throw new Error('Failed to fetch author evolution')
    }

    return data || []
  }

  async addAuthorEvolution(evolution: Omit<AuthorEvolution, 'id' | 'created_at'>): Promise<AuthorEvolution> {
    const { data, error } = await this.supabase
      .from('author_evolution')
      .insert(evolution)
      .select()
      .single()

    if (error) {
      console.error('Error adding author evolution:', error)
      throw new Error('Failed to add author evolution')
    }

    return data
  }

  async getContradictingArticles(authorId: number): Promise<ArticleWithSource[]> {
    const { data, error } = await this.supabase
      .from('articles_with_sources')
      .select('*')
      .eq('author_id', authorId)
      .eq('contradicts_previous', true)
      .order('published_at', { ascending: false })

    if (error) {
      console.error('Error fetching contradicting articles:', error)
      throw new Error('Failed to fetch contradicting articles')
    }

    return data || []
  }

  async linkArticleToAuthor(articleId: number, authorId: number): Promise<void> {
    const { error } = await this.supabase
      .from('articles')
      .update({ author_id: authorId })
      .eq('id', articleId)

    if (error) {
      console.error('Error linking article to author:', error)
      throw new Error('Failed to link article to author')
    }
  }
}

// Export a singleton instance
export const db = new DatabaseService() 