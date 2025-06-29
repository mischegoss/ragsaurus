export interface RAGPluginOptions {
  /** Enable/disable the plugin */
  enabled?: boolean
  /** Enable verbose logging */
  verbose?: boolean
  /** Path to documentation directory */
  docsPath?: string
  /** Skip interactive prompt in development */
  skipPrompt?: boolean
  /** Agent configuration */
  agents?: AgentConfiguration
  /** GitHub integration options */
  github?: GitHubConfiguration
  /** Maximum number of agents to run */
  maxAgents?: number
  /** Target directory for enhanced docs */
  outputPath?: string
}

export interface AgentConfiguration {
  /** Enable SEO metadata generation agent */
  seo?: boolean
  /** Enable topic taxonomy agent */
  topology?: boolean
  /** Enable document chunking optimizer agent */
  chunking?: boolean
  /** Enable content research agent */
  research?: boolean
}

export interface GitHubConfiguration {
  /** Create pull requests with enhancements */
  createPR?: boolean
  /** GitHub repository owner */
  owner?: string
  /** GitHub repository name */
  repo?: string
  /** GitHub access token (optional, can use env var) */
  token?: string
}

export interface EnvironmentConfig {
  /** Google Gemini API key */
  googleApiKey?: string
  /** Tavily API key for web research */
  tavilyApiKey?: string
  /** Skip interactive prompt */
  skipPrompt: boolean
  /** Node environment */
  nodeEnv: string
  /** Is development environment */
  isDevelopment: boolean
  /** Is production environment */
  isProduction: boolean
}

export interface EnvValidationResult {
  /** Are all required environment variables present */
  isValid: boolean
  /** List of missing required variables */
  missing: string[]
  /** List of present variables */
  present: string[]
  /** Parsed environment configuration */
  config: EnvironmentConfig
}

export interface ProcessingResult {
  /** Number of files processed */
  filesProcessed: number
  /** Number of enhancements applied */
  enhancementsApplied: number
  /** Average RAG score across all files */
  ragScore: number
  /** Total processing time in milliseconds */
  processingTime: number
  /** Results from individual agents */
  agentResults: AgentResult[]
  /** Processing summary */
  summary: ProcessingSummary
}

export interface AgentResult {
  /** Name of the agent */
  agentName: string
  /** Role/description of the agent */
  agentRole: string
  /** Agent processing result */
  result: any
  /** Time taken by this agent */
  processingTime: number
  /** Whether content was modified */
  contentModified: boolean
  /** Position in processing sequence */
  sequencePosition: number
  /** Error if agent failed */
  error?: string
}

export interface ProcessingSummary {
  /** Total files discovered */
  totalFiles: number
  /** Successfully processed files */
  successful: number
  /** Failed processing count */
  failed: number
  /** Average RAG score */
  averageRagScore: number
  /** Top improvements made */
  topImprovements?: Improvement[]
  /** Top added metadata fields */
  topAddedFields?: AddedField[]
}

export interface Improvement {
  /** Type of improvement */
  type: string
  /** Number of files this improvement was applied to */
  count: number
  /** Description of the improvement */
  description?: string
}

export interface AddedField {
  /** Name of the metadata field */
  field: string
  /** Number of files this field was added to */
  count: number
  /** Sample value for this field */
  sampleValue?: any
}

export interface DocumentInfo {
  /** Relative path to the document */
  path: string
  /** Full absolute path */
  fullPath: string
  /** Document title */
  title: string
  /** Document content (without frontmatter) */
  content: string
  /** Parsed frontmatter */
  frontmatter: Record<string, any>
  /** Word count */
  wordCount: number
  /** Original content with frontmatter */
  originalContent?: string
}

export interface EnhancementMetadata {
  /** SEO-related metadata */
  seo?: {
    keywords?: string[]
    description?: string
    title?: string
  }
  /** Topic classification */
  topics?: {
    primary?: string
    secondary?: string[]
    categories?: string[]
  }
  /** Chunking optimization */
  chunking?: {
    optimalChunkSize?: number
    chunkingScore?: number
    structureImprovements?: number
  }
  /** Content research findings */
  research?: {
    relatedTopics?: string[]
    industryTrends?: string[]
    bestPractices?: string[]
  }
  /** Overall RAG score */
  ragScore?: number
  /** Enhancement timestamp */
  enhancedAt?: string
  /** Plugin version */
  enhancedBy?: string
}
