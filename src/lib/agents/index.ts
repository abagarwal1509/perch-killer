export { BaseAgent, type HistoricalArticle, type AgentResult, type PlatformIndicators } from './base-agent'
export { GhostAgent } from './ghost-agent'
export { PosthavenAgent } from './posthaven-agent'
export { VCCircleAgent } from './vccircle-agent'
export { WordPressAgent } from './wordpress-agent'
export { SubstackAgent } from './substack-agent'
export { MediumAgent } from './medium-agent'
export { NavalAgent } from './naval-agent'
export { UniversalAgent } from './universal-agent'
export { CollectionOrchestrator, type OrchestrationResult } from './collection-orchestrator'

// Re-export the main interface for backward compatibility
export type { HistoricalArticle as HistoricalCollectorResult } from './base-agent'

// Import for local use
import { CollectionOrchestrator } from './collection-orchestrator'

// Main entry point for historical article collection
export const createCollectionOrchestrator = () => new CollectionOrchestrator() 