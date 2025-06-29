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
 * RAG Documentation Enhancement Plugin for Docusaurus
 *
 * This plugin uses AI agents to enhance documentation with improved metadata,
 * better chunking, SEO optimization, and content research.
 */
export default function ragPrepPlugin(
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
        const envResult = await this.validateEnvironment(context, options)
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
        const shouldRun = await this.shouldRunProcessing(
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

        const result = await this.runRAGProcessing(
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
        console.error('❌ RAG Plugin Error:', error.message)
        if (verbose) {
          console.error('Stack trace:', error.stack)
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
     * Validate environment variables and configuration
     */
    async validateEnvironment(
      context: LoadContext,
      options: RAGPluginOptions,
    ): Promise<EnvValidationResult> {
      // Load environment variables from .env files
      await this.loadEnvironmentFiles(context)

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
        isDevelopment:
          (process.env.NODE_ENV || 'development') === 'development',
        isProduction: process.env.NODE_ENV === 'production',
      }

      return {
        isValid: missing.length === 0,
        missing,
        present: [...present, ...optional.filter(key => process.env[key])],
        config,
      }
    },

    /**
     * Load environment files (.env.local, .env, etc.)
     */
    async loadEnvironmentFiles(context: LoadContext): Promise<void> {
      try {
        const dotenv = require('dotenv')
        const envFiles = ['.env.local', '.env']

        for (const envFile of envFiles) {
          const envPath = path.join(context.siteDir, envFile)
          if (await fs.pathExists(envPath)) {
            dotenv.config({ path: envPath })
            if (verbose) {
              console.log(`🔍 [RAG Plugin] Loaded env from: ${envFile}`)
            }
            break
          }
        }
      } catch (error) {
        // Dotenv not available or files not found - that's ok
        if (verbose) {
          console.log('💡 No .env files found or dotenv not available')
        }
      }
    },

    /**
     * Determine if processing should run based on environment and user input
     */
    async shouldRunProcessing(
      config: EnvironmentConfig,
      forceSkipPrompt: boolean,
    ): Promise<boolean> {
      // Always run in production
      if (config.isProduction) {
        if (verbose) {
          console.log('🚀 RAG Prep Plugin starting (production mode)...')
        }
        return true
      }

      // Skip prompt if configured
      if (config.skipPrompt || forceSkipPrompt) {
        if (verbose) {
          console.log('⏭️ Skipping RAG enhancement (skipPrompt=true)')
        }
        return false
      }

      // Show interactive prompt in development
      return await this.promptUser()
    },

    /**
     * Interactive prompt for development mode
     */
    async promptUser(): Promise<boolean> {
      const readline = require('readline')

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      })

      console.log('\n📋 RAG Documentation Enhancement Plugin')
      console.log(
        '💡 This will run AI agents to analyze and enhance documentation',
      )
      console.log(
        '⚡ Tip: Set RAG_SKIP_PROMPT=true in .env.local to always skip this prompt',
      )

      return new Promise(resolve => {
        rl.question(
          '🤖 Do you want to run RAG documentation enhancement? (y/N): ',
          answer => {
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
    },

    /**
     * Main RAG processing workflow
     */
    async runRAGProcessing(
      context: LoadContext,
      config: EnvironmentConfig,
      options: RAGPluginOptions,
    ): Promise<ProcessingResult> {
      // Import heavy dependencies only when needed
      const DocumentProcessingTeam = require('./teams/documentProcessingTeam')
      const EnhanceMetadataTask = require('./tasks/enhanceMetadataTask')

      const startTime = Date.now()

      // Determine target docs directory
      const siteDir = context.siteDir
      const targetDocsDir = path.join(
        siteDir,
        options.outputPath || 'docs-enhanced/sample-docs',
      )

      if (verbose) {
        console.log('📄 Target docs directory:', targetDocsDir)
      }

      // Discover and analyze documents
      console.log('\n🔍 Starting document discovery...')
      const processedFiles = await this.discoverDocuments(targetDocsDir)

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

      if (verbose) {
        console.log(
          `🤖 Initialized team with ${documentTeam.agents.length} agents`,
        )
      }

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

      if (verbose) {
        console.log(`\n🎉 RAG enhancement completed in ${processingTime}ms`)
        console.log(
          `📊 Enhanced ${enhancementResult.enhancementsApplied}/${enhancementResult.filesProcessed} files`,
        )
      }

      return enhancementResult
    },

    /**
     * Discover markdown documents in the target directory
     */
    async discoverDocuments(docsDir: string): Promise<any[]> {
      const matter = require('gray-matter')

      try {
        if (!(await fs.pathExists(docsDir))) {
          if (verbose) {
            console.log(`📁 Creating docs directory: ${docsDir}`)
          }
          await fs.ensureDir(docsDir)
          return []
        }

        // Find all markdown files
        const files = await fs.readdir(docsDir)
        const markdownFiles = files.filter(
          file => file.endsWith('.md') && !file.includes('.backup'),
        )

        console.log('📚 Found', markdownFiles.length, 'markdown files:')

        const processedFiles = []

        for (let i = 0; i < markdownFiles.length; i++) {
          const file = markdownFiles[i]
          const fullPath = path.join(docsDir, file)

          try {
            const content = await fs.readFile(fullPath, 'utf8')
            const parsed = matter(content)

            const fileInfo = {
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
            console.warn(`⚠️ Error reading ${file}: ${error.message}`)
          }
        }

        return processedFiles
      } catch (error) {
        console.error('❌ Error discovering documents:', error.message)
        return []
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

// Export types for TypeScript users
export type { RAGPluginOptions, ProcessingResult, EnvironmentConfig }

// Export plugin as both default and named export for compatibility
export { ragPrepPlugin }

/**
 * Usage example:
 *
 * // docusaurus.config.js
 * module.exports = {
 *   plugins: [
 *     [
 *       'docusaurus-plugin-rag-prep',
 *       {
 *         enabled: true,
 *         verbose: true,
 *         docsPath: 'docs',
 *         skipPrompt: false,
 *         agents: {
 *           seo: true,
 *           topology: true,
 *           chunking: true,
 *           research: true,
 *         },
 *         github: {
 *           createPR: true,
 *           owner: 'your-org',
 *           repo: 'your-repo',
 *         },
 *       },
 *     ],
 *   ],
 * };
 */
