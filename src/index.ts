// src/index.ts
import { LoadContext, Plugin } from '@docusaurus/types'
import * as path from 'path'
import * as fs from 'fs-extra'

/**
 * Plugin Options Interface
 */
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
  agents?: {
    seo?: boolean
    topology?: boolean
    chunking?: boolean
    research?: boolean
  }
  /** GitHub integration options */
  github?: {
    createPR?: boolean
    owner?: string
    repo?: string
    token?: string
  }
  /** Maximum number of agents to run */
  maxAgents?: number
  /** Target directory for enhanced docs */
  outputPath?: string
}

/**
 * Environment validation result
 */
interface EnvValidationResult {
  isValid: boolean
  missing: string[]
  present: string[]
  config: EnvironmentConfig
}

/**
 * Environment configuration
 */
interface EnvironmentConfig {
  googleApiKey?: string
  tavilyApiKey?: string
  skipPrompt: boolean
  nodeEnv: string
  isDevelopment: boolean
  isProduction: boolean
}

/**
 * Processing result from RAG workflow
 */
interface ProcessingResult {
  filesProcessed: number
  enhancementsApplied: number
  ragScore: number
  processingTime: number
  agentResults: any[]
  summary: any
}

/**
 * Document info interface
 */
interface DocumentInfo {
  path: string
  fullPath: string
  title: string
  content: string
  frontmatter: Record<string, any>
  wordCount: number
}

/**
 * Load environment files (.env.local, .env, etc.)
 */
async function loadEnvironmentFiles(context: LoadContext): Promise<void> {
  try {
    const dotenv = require('dotenv')
    const envFiles = ['.env.local', '.env']

    for (const envFile of envFiles) {
      const envPath = path.join(context.siteDir, envFile)
      if (await fs.pathExists(envPath)) {
        dotenv.config({ path: envPath })
        break
      }
    }
  } catch (error) {
    // Dotenv not available or files not found - that's ok
  }
}

/**
 * Validate environment variables and configuration
 */
async function validateEnvironment(
  context: LoadContext,
  options: RAGPluginOptions,
): Promise<EnvValidationResult> {
  // Load environment variables from .env files
  await loadEnvironmentFiles(context)

  const required = ['GOOGLE_API_KEY', 'TAVILY_API_KEY']
  const optional = ['RAG_SKIP_PROMPT', 'NODE_ENV']

  const missing = required.filter(key => !process.env[key])
  const present = required.filter(key => process.env[key])

  const config: EnvironmentConfig = {
    googleApiKey: process.env.GOOGLE_API_KEY,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    skipPrompt:
      process.env.RAG_SKIP_PROMPT === 'true' || options.skipPrompt || false,
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  }

  return {
    isValid: missing.length === 0,
    missing,
    present: [...present, ...optional.filter(key => process.env[key])],
    config,
  }
}

/**
 * Determine if processing should run based on environment and user input
 */
async function shouldRunProcessing(
  config: EnvironmentConfig,
  forceSkipPrompt: boolean,
): Promise<boolean> {
  // Always run in production
  if (config.isProduction) {
    return true
  }

  // Skip prompt if configured
  if (config.skipPrompt || forceSkipPrompt) {
    return false
  }

  // Show interactive prompt in development
  return await promptUser()
}

/**
 * Interactive prompt for development mode
 */
async function promptUser(): Promise<boolean> {
  const readline = require('readline')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log('\n📋 RAG Documentation Enhancement Plugin')
  console.log('💡 This will run AI agents to analyze and enhance documentation')
  console.log(
    '⚡ Tip: Set RAG_SKIP_PROMPT=true in .env.local to always skip this prompt',
  )

  return new Promise(resolve => {
    rl.question(
      '🤖 Do you want to run RAG documentation enhancement? (y/N): ',
      (answer: string) => {
        rl.close()
        const shouldRun = answer.toLowerCase().trim() === 'y'

        if (shouldRun) {
          console.log('✅ Starting RAG enhancement workflow...')
        } else {
          console.log('⏭️ Skipping RAG enhancement (faster startup)')
          console.log(
            '💡 You can run it later by restarting with "y" when prompted',
          )
        }

        resolve(shouldRun)
      },
    )
  })
}

/**
 * Main RAG processing workflow
 */
async function runRAGProcessing(
  context: LoadContext,
  config: EnvironmentConfig,
  options: RAGPluginOptions,
): Promise<ProcessingResult> {
  // Import heavy dependencies only when needed
  const DocumentProcessingTeam = require('./teams/documentProcessingTeam')

  const startTime = Date.now()

  // Determine target docs directory
  const siteDir = context.siteDir
  const targetDocsDir = path.join(
    siteDir,
    options.outputPath || 'docs-enhanced/sample-docs',
  )

  // Discover and analyze documents
  console.log('\n🔍 Starting document discovery...')
  const processedFiles = await discoverDocuments(targetDocsDir)

  if (processedFiles.length === 0) {
    console.log('ℹ️ No documents found to process')
    return {
      filesProcessed: 0,
      enhancementsApplied: 0,
      ragScore: 0,
      processingTime: Date.now() - startTime,
      agentResults: [],
      summary: { message: 'No documents found' },
    }
  }

  // Initialize and run the multi-agent workflow
  const documentTeam = new DocumentProcessingTeam()
  await documentTeam.initialize()

  // Process documents with the agent team
  const result = await documentTeam.processDocuments(processedFiles)

  // Calculate final metrics
  const processingTime = Date.now() - startTime
  const enhancementResult: ProcessingResult = {
    filesProcessed: processedFiles.length,
    enhancementsApplied: result?.successful || 0,
    ragScore: result?.averageRagScore || 0,
    processingTime,
    agentResults: result?.agentResults || [],
    summary: result || { message: 'Processing completed' },
  }

  return enhancementResult
}

/**
 * Discover markdown documents in the target directory
 */
async function discoverDocuments(docsDir: string): Promise<DocumentInfo[]> {
  const matter = require('gray-matter')

  try {
    if (!(await fs.pathExists(docsDir))) {
      await fs.ensureDir(docsDir)
      return []
    }

    // Find all markdown files
    const files = await fs.readdir(docsDir)
    const markdownFiles = files.filter(
      (file: string) => file.endsWith('.md') && !file.includes('.backup'),
    )

    console.log('📚 Found', markdownFiles.length, 'markdown files:')

    const processedFiles: DocumentInfo[] = []

    for (let i = 0; i < markdownFiles.length; i++) {
      const file = markdownFiles[i]
      const fullPath = path.join(docsDir, file)

      try {
        const content = await fs.readFile(fullPath, 'utf8')
        const parsed = matter(content)

        const fileInfo: DocumentInfo = {
          path: file,
          fullPath,
          title: parsed.data.title || file.replace('.md', ''),
          content: parsed.content,
          frontmatter: parsed.data,
          wordCount: parsed.content.split(/\s+/).length,
        }

        processedFiles.push(fileInfo)

        console.log(
          `  ${i + 1}. ${file} (${fileInfo.wordCount} words) - "${
            fileInfo.title
          }"`,
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        console.warn(`⚠️ Error reading ${file}: ${errorMessage}`)
      }
    }

    return processedFiles
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error discovering documents:', errorMessage)
    return []
  }
}

/**
 * RAG Documentation Enhancement Plugin for Docusaurus
 */
function ragPrepPlugin(
  context: LoadContext,
  options: RAGPluginOptions = {},
): Plugin<ProcessingResult | null> {
  const {
    enabled = true,
    verbose = false,
    docsPath = 'docs',
    skipPrompt = false,
    agents = {
      seo: true,
      topology: true,
      chunking: true,
      research: true,
    },
    maxAgents = 6,
    outputPath = 'docs-enhanced',
    github = {
      createPR: false,
    },
  } = options

  return {
    name: 'docusaurus-plugin-rag-prep',

    /**
     * Load and validate environment, then process documents if enabled
     */
    async loadContent(): Promise<ProcessingResult | null> {
      if (!enabled) {
        if (verbose) {
          console.log('⏭️ RAG Plugin disabled via configuration')
        }
        return null
      }

      try {
        // Step 1: Load and validate environment
        const envResult = await validateEnvironment(context, options)
        if (!envResult.isValid) {
          console.warn(
            '⚠️ RAG Plugin: Missing required environment variables:',
            envResult.missing,
          )
          if (verbose) {
            console.log('💡 Required: GOOGLE_API_KEY, TAVILY_API_KEY')
            console.log('💡 Optional: RAG_SKIP_PROMPT')
            console.log('💡 Add these to your .env.local file')
          }
          return null
        }

        // Step 2: Handle interactive prompt in development
        const shouldRun = await shouldRunProcessing(
          envResult.config,
          skipPrompt,
        )
        if (!shouldRun) {
          if (verbose) {
            console.log('⏭️ Skipping RAG enhancement (faster startup)')
            console.log(
              '💡 You can run it later by restarting with "y" when prompted',
            )
          }
          return null
        }

        // Step 3: Run RAG processing workflow
        if (verbose) {
          console.log('🚀 RAG Prep Plugin initialized')
          console.log('📁 Site directory:', context.siteDir)
        }

        const result = await runRAGProcessing(
          context,
          envResult.config,
          options,
        )

        if (verbose && result) {
          console.log('✅ RAG enhancement completed successfully')
          console.log(`📊 Processed ${result.filesProcessed} files`)
          console.log(`🎯 Average RAG score: ${result.ragScore}/100`)
        }

        return result
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        const errorStack =
          error instanceof Error ? error.stack : 'No stack trace'

        console.error('❌ RAG Plugin Error:', errorMessage)
        if (verbose) {
          console.error('Stack trace:', errorStack)
        }
        console.log('💡 Continuing with normal Docusaurus startup...')
        return null
      }
    },

    /**
     * Use the loaded content to set global data or create routes
     */
    async contentLoaded({ content, actions }): Promise<void> {
      if (content) {
        // Make RAG processing results available globally
        actions.setGlobalData({
          ragEnhancement: {
            enabled: true,
            filesProcessed: content.filesProcessed,
            ragScore: content.ragScore,
            processingTime: content.processingTime,
            timestamp: new Date().toISOString(),
          },
        })

        if (verbose) {
          console.log('📊 RAG enhancement data available globally')
        }
      }
    },

    /**
     * Get paths to watch for hot reload
     */
    getPathsToWatch(): string[] {
      const watchPaths = [
        path.resolve(context.siteDir, options.docsPath || 'docs'),
        path.resolve(context.siteDir, options.outputPath || 'docs-enhanced'),
      ]

      if (verbose) {
        console.log('👀 Watching paths:', watchPaths)
      }

      return watchPaths
    },

    /**
     * Configure webpack if needed
     */
    configureWebpack(config, isServer, utils) {
      return {
        resolve: {
          alias: {
            // Add any aliases if needed
          },
        },
      }
    },
  }
}

// Export as both default and named for compatibility
export default ragPrepPlugin
export { ragPrepPlugin }

// Type exports for users
export type {
  RAGPluginOptions as PluginOptions,
  ProcessingResult,
  EnvironmentConfig,
}
