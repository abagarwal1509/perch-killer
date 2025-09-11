# Agent-Based Historical Article Collection System

## 🏗️ Architecture Overview

This directory contains the new agent-based architecture for collecting historical articles from various blogging platforms. It replaces the old monolithic `HistoricalCollector` with a flexible, extensible system.

## 📁 File Structure

```
src/lib/agents/
├── README.md                    # This documentation
├── index.ts                     # Public exports and main entry point
├── base-agent.ts               # Abstract base class and interfaces
├── collection-orchestrator.ts  # Main intelligence/routing system
├── ghost-agent.ts              # Specialized agent for Ghost CMS blogs
├── universal-agent.ts          # Fallback agent for any website
└── [future agents]             # WordPress, Substack, Medium, etc.
```

## 🎯 Key Benefits

### **Old System Problems:**
- ❌ **2000+ line monolith** - Hard to maintain and debug
- ❌ **Fixed strategy order** - Not optimal for all platforms
- ❌ **Hard to extend** - Adding new platforms required modifying core class
- ❌ **Poor debugging** - Difficult to know which strategy failed and why
- ❌ **One-size-fits-all** - Generic strategies couldn't be optimized for specific platforms

### **New System Advantages:**
- ✅ **Modular design** - Each agent is independent and focused
- ✅ **Intelligent routing** - System picks the best agent based on confidence scores
- ✅ **Easy to extend** - New platforms = new agent files
- ✅ **Rich debugging** - Detailed logs show agent selection process and reasoning
- ✅ **Platform optimization** - Each agent uses platform-specific APIs and patterns
- ✅ **Graceful fallback** - Failed agents automatically fall back to universal strategies
- ✅ **Unknown platform detection** - System flags when new agents might be needed

## 🤖 Available Agents

### **GhostAgent**
- **Platforms:** Ghost CMS blogs (like Sam Altman's blog)
- **Confidence:** 90% for known Ghost sites, 80% for blog subdomains
- **Methods:** Ghost API, specialized RSS feeds, Ghost-specific sitemaps
- **Special Features:** Handles Ghost's unique sitemap structure and API endpoints

### **UniversalAgent** 
- **Platforms:** Any website (fallback)
- **Confidence:** 30% (intentionally low as fallback)
- **Methods:** Generic RSS feeds, standard sitemaps, pagination patterns
- **Special Features:** Paul Graham external RSS feed, comprehensive sitemap parsing

### **Future Agents** (TODO)
- `WordPressAgent` - WordPress blogs and WP.com
- `SubstackAgent` - Substack newsletters
- `MediumAgent` - Medium profiles and publications
- `NotionAgent` - Notion published pages
- `DevToAgent` - Dev.to articles

## 🔄 How It Works

### 1. **Analysis Phase**
```typescript
const orchestrator = new CollectionOrchestrator()
const analysis = await orchestrator.testUrlAnalysis(url)
// Returns confidence scores from all agents
```

### 2. **Selection Phase**
- System picks agent with highest confidence (>0.1 threshold)
- Factors in platform-specific optimizations
- Falls back to Universal Agent if no specialized agent available

### 3. **Verification Phase**
```typescript
const canHandle = await selectedAgent.verify(url)
// Deep verification (network requests, content analysis)
```

### 4. **Collection Phase**
```typescript
const result = await selectedAgent.collect(url)
// Platform-optimized collection with rich metadata
```

### 5. **Fallback System**
- If specialized agent fails verification → Universal Agent
- If collection fails → Emergency fallback
- Rich error reporting throughout

## 🚀 Usage Examples

### **Basic Collection (Backward Compatible)**
```typescript
import { HistoricalCollector } from '@/lib/historical-collector'

// Works exactly like before, but now uses agent system
const articles = await HistoricalCollector.collectHistoricalArticles(url)
```

### **Advanced Collection (New Features)**
```typescript
import { CollectionOrchestrator } from '@/lib/agents'

const orchestrator = new CollectionOrchestrator()
const result = await orchestrator.collectHistoricalArticles(url)

console.log(`Agent used: ${result.agentUsed}`)
console.log(`Platform: ${result.metadata?.platformDetected}`)
console.log(`Articles found: ${result.articlesFound}`)

if (result.needsAttention) {
  console.log('Consider creating specialized agent for:', result.needsAttention.platformAnalysis)
}
```

### **Testing & Analysis**
```typescript
// Analyze URL without collecting (for debugging)
const analysis = await orchestrator.testUrlAnalysis(url)
console.log('Best agent:', analysis.recommendation.agent)
console.log('Should create specialized agent:', analysis.recommendation.shouldCreateSpecializedAgent)
```

## 🛠️ Creating New Agents

### 1. **Extend BaseAgent**
```typescript
import { BaseAgent, AgentResult, PlatformIndicators } from './base-agent'

export class MyPlatformAgent extends BaseAgent {
  name = 'My Platform Agent'
  description = 'Agent for XYZ platform'
  
  async canHandle(url: string): Promise<number> {
    // Return confidence 0-1
    return url.includes('myplatform.com') ? 0.9 : 0.1
  }
  
  async verify(url: string): Promise<boolean> {
    // Deep verification logic
  }
  
  async collect(url: string): Promise<AgentResult> {
    // Collection implementation
  }
  
  getPlatformIndicators(): PlatformIndicators {
    // Platform detection patterns
  }
}
```

### 2. **Register in Orchestrator**
```typescript
// In collection-orchestrator.ts
this.agents = [
  new GhostAgent(),
  new MyPlatformAgent(), // Add here
  new UniversalAgent()   // Always keep last
]
```

## 🔍 Debugging & Monitoring

### **Rich Console Logs**
The system provides detailed logs showing:
- Agent confidence scores for URL analysis
- Selected agent and reasoning
- Platform detection results
- Collection methods used (RSS, sitemap, API)
- Performance metrics (timing, article counts)
- Error details and fallback triggers

### **Attention Flags**
When system detects an unknown platform:
```typescript
if (result.needsAttention) {
  console.log('🚨 ATTENTION:', result.needsAttention.reason)
  console.log('Platform:', result.needsAttention.platformAnalysis)
  console.log('Suggestions:', result.needsAttention.suggestions)
}
```

### **Performance Monitoring**
```typescript
console.log(`Agent: ${result.agentUsed}`)
console.log(`Duration: ${result.metadata?.totalTime}ms`)
console.log(`Methods: ${result.metadata?.methodsUsed}`)
console.log(`Confidence: ${result.confidence}`)
```

## 🧪 Testing

The enhanced test API endpoint (`/api/test-historical-collection`) now provides:
- Agent analysis breakdown
- Platform detection results
- Collection method details
- Performance metrics
- Attention flags for unknown platforms

Perfect for debugging new platforms and validating agent behavior.

## 🎯 Roadmap

### **Phase 1: Core Agents** ✅
- [x] Base architecture
- [x] Ghost Agent (Sam Altman's blog)
- [x] Universal Agent (fallback)
- [x] Collection Orchestrator

### **Phase 2: Popular Platforms**
- [ ] WordPress Agent (most common blogging platform)
- [ ] Substack Agent (newsletter platforms)
- [ ] Medium Agent (Medium publications)

### **Phase 3: Specialized Platforms**
- [ ] Dev.to Agent (developer blogs)
- [ ] Hashnode Agent (developer blogs)
- [ ] Notion Agent (published Notion pages)

### **Phase 4: Advanced Features**
- [ ] Machine learning confidence scoring
- [ ] Automatic agent suggestion based on URL patterns
- [ ] Performance caching and optimization
- [ ] Rate limiting and request management

## 💡 Contributing

When adding support for a new platform:

1. **Analyze the platform** - API endpoints, RSS patterns, sitemap structure
2. **Create specialized agent** - Extend BaseAgent with platform-specific logic
3. **Add platform detection** - URL patterns, HTML indicators, API endpoints
4. **Test thoroughly** - Use test API endpoint to validate behavior
5. **Update orchestrator** - Register agent in priority order
6. **Document** - Update this README with new agent details

The agent system makes it easy to add new platforms without affecting existing functionality! 