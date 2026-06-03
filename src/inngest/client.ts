import { Inngest } from 'inngest'

// Event payload sent when a source needs (re)collection.
export type CollectionRequested = {
  data: {
    jobId: number
    sourceId: number
    userId: string
    url: string
    type: 'historical' | 'refresh'
  }
}

type Events = {
  'collection/source.requested': CollectionRequested
}

export const inngest = new Inngest({ id: 'bloghub' })
export type { Events }
