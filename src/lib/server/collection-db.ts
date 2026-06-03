import 'server-only'
import { getSupabaseAdmin } from './supabase-admin'

function estimateReadTime(content: string): string {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wordsPerMinute)
  return `${minutes} min read`
}

export interface JobSource {
  id: number
  name: string
  url: string
  user_id: string
}

export type JobType = 'historical' | 'refresh'
export type JobStatus = 'pending' | 'running' | 'done' | 'error'

export interface CollectionJob {
  id: number
  user_id: string
  source_id: number | null
  url: string
  type: JobType
  status: JobStatus
  agent_used: string | null
  articles_added: number
  progress: Record<string, any>
  error: string | null
}

/**
 * Persist agent-collected articles for a source. `userId` is taken from the
 * authenticated job — never from client input — and stamped on every row so
 * the service-role write stays scoped to the owning user.
 */
export async function persistAgentArticles(
  userId: string,
  source: { id: number; name: string },
  articles: any[],
): Promise<number> {
  if (!articles.length) return 0
  const admin = getSupabaseAdmin()

  const rows = articles.map((article: any) => ({
    source_id: source.id,
    user_id: userId,
    title: article.title,
    description: article.description || 'Article collected via intelligent agent system',
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
    related_article_ids: [],
  }))

  const { data, error } = await admin
    .from('articles')
    .upsert(rows, { onConflict: 'source_id,url', ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(`Failed to persist articles: ${error.message}`)
  return data?.length || 0
}

export async function updateSourceArticleCount(sourceId: number): Promise<void> {
  const admin = getSupabaseAdmin()
  const { count } = await admin
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', sourceId)
  await admin
    .from('sources')
    .update({ articles_count: count || 0, last_fetched_at: new Date().toISOString() })
    .eq('id', sourceId)
}

export async function getSource(sourceId: number): Promise<JobSource | null> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('sources')
    .select('id, name, url, user_id')
    .eq('id', sourceId)
    .single()
  return (data as JobSource) || null
}

export async function getAllSources(): Promise<JobSource[]> {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('sources').select('id, name, url, user_id')
  return (data as JobSource[]) || []
}

// --- collection_jobs helpers ---

export async function createJob(params: {
  userId: string
  sourceId: number | null
  url: string
  type: JobType
}): Promise<CollectionJob> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('collection_jobs')
    .insert({
      user_id: params.userId,
      source_id: params.sourceId,
      url: params.url,
      type: params.type,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error) throw new Error(`Failed to create job: ${error.message}`)
  return data as CollectionJob
}

export async function updateJob(id: number, patch: Partial<CollectionJob> & Record<string, any>): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await admin.from('collection_jobs').update(patch).eq('id', id)
  if (error) throw new Error(`Failed to update job ${id}: ${error.message}`)
}
