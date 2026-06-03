import { inngest } from './client'
import { CollectionOrchestrator } from '@/lib/agents'
import {
  getSource,
  persistAgentArticles,
  updateSourceArticleCount,
  updateJob,
} from '@/lib/server/collection-db'

/**
 * Durable background collection for a single source. Runs server-side (survives
 * the browser tab closing) and reports progress by updating the collection_jobs
 * row, which the client observes via Supabase Realtime.
 *
 * NOTE: collection currently runs in one step. Sources that take longer than
 * the Vercel function limit (~60s) would need per-page chunking via the job
 * `cursor` — tracked as a follow-up. Most blogs finish well under the limit.
 */
export const collectSource = inngest.createFunction(
  {
    id: 'collect-source',
    name: 'Collect articles for a source',
    retries: 2,
    triggers: [{ event: 'collection/source.requested' }],
  },
  async ({ event, step }) => {
    const { jobId, sourceId, userId, url } = event.data

    await step.run('mark-running', async () => {
      await updateJob(jobId, { status: 'running', started_at: new Date().toISOString() })
    })

    try {
      const result = await step.run('collect-and-persist', async () => {
        const source = await getSource(sourceId)
        if (!source) throw new Error(`Source ${sourceId} not found`)

        const orchestrator = new CollectionOrchestrator()
        const collection = await orchestrator.collectHistoricalArticles(url)

        let added = 0
        if (collection.success && collection.articles.length > 0) {
          added = await persistAgentArticles(userId, source, collection.articles as any[])
        }
        await updateSourceArticleCount(sourceId)

        return {
          added,
          agentUsed: collection.agentUsed,
          found: collection.articles.length,
          success: collection.success,
        }
      })

      await step.run('mark-done', async () => {
        await updateJob(jobId, {
          status: 'done',
          articles_added: result.added,
          agent_used: result.agentUsed,
          progress: { found: result.found },
          finished_at: new Date().toISOString(),
        })
      })

      return result
    } catch (err) {
      await step.run('mark-error', async () => {
        await updateJob(jobId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          finished_at: new Date().toISOString(),
        })
      })
      throw err
    }
  },
)

export const functions = [collectSource]
