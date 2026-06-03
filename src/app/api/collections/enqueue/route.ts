import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { createJob } from '@/lib/server/collection-db'
import { inngest } from '@/inngest/client'

/**
 * Enqueue a background collection job for a source the caller owns.
 *
 * Auth: the browser client persists its session in localStorage (not cookies),
 * so it must send the access token as `Authorization: Bearer <token>`. We verify
 * it with the service-role client and confirm the source belongs to that user
 * before creating the job — the client never supplies the user_id.
 */
export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const body = await request.json()
    const sourceId = Number(body.sourceId)
    const type: 'historical' | 'refresh' = body.type === 'refresh' ? 'refresh' : 'historical'
    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
    }

    // Confirm ownership before doing anything with the service role.
    const { data: source } = await admin
      .from('sources')
      .select('id, user_id, url')
      .eq('id', sourceId)
      .single()
    if (!source || source.user_id !== user.id) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    }

    const job = await createJob({ userId: user.id, sourceId, url: source.url, type })

    await inngest.send({
      name: 'collection/source.requested',
      data: { jobId: job.id, sourceId, userId: user.id, url: source.url, type },
    })

    return NextResponse.json({ jobId: job.id, status: job.status })
  } catch (error) {
    console.error('Enqueue error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enqueue collection' },
      { status: 500 },
    )
  }
}
