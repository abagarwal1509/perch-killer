import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { functions } from '@/inngest/functions'

// Allow up to the Vercel hobby max so a single collection step has room.
export const maxDuration = 60

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
