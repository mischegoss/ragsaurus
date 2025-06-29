// src/types.ts
/**
 * Type definitions for the RAG Documentation Enhancement Plugin
 */

export interface RAGPluginOptions {
    /** Enable/disable the plugin */
    enabled?: boolean;
    /** Enable verbose logging */
    verbose?: boolean;
    /** Path to documentation directory */
    docsPath?: string;
    /** Skip interactive prompt in development */
    skipPrompt?: boolean;
    /** Agent configuration */
    agents?: AgentConfiguration;
    /** GitHub integration options */
    github?: GitHubConfiguration;
    /** Maximum number of agents to run */
    maxAgents?: number;
    /** Target directory for enhanced docs */
    outputPath?: string;
  }
  
  export interface AgentConfiguration {
    /** Enable SEO metadata generation agent */
    seo?: boolean;
    /** Enable topic taxonomy agent */
    topology?: boolean;
    /** Enable document chunking optimizer agent */
    chunking?: boolean;
    /** Enable content research agent */
    research?: boolean;
  }
  
  export interface GitHubConfiguration {
    /** Create pull requests with enhancements */
    createPR?: boolean;
    /** GitHub repository owner */
    owner?: string;
    /** GitHub repository name */
    repo?: string;
    /** GitHub access token (optional, can use env var) */
    token?: string;
  }
  
  export interface EnvironmentConfig {
    /** Google Gemini API key */
    googleApiKey?: string;
    /** Tavily API key for web research */
    tavilyApiKey?: string;
    /** Skip interactive prompt */
    skipPrompt: boolean;
    /** Node environment */
    nodeEnv: string;
    /** Is development environment */
    isDevelopment: boolean;
    /** Is production environment */
    isProduction: boolean;
  }
  
  export interface EnvValidationResult {
    /** Are all required environment variables present */
    isValid: boolean;
    /** List of missing required variables */
    missing: string[];
    /** List of present variables */
    present: string[];
    /** Parsed environment configuration */
    config: EnvironmentConfig;
  }
  
  export interface ProcessingResult {
    /** Number of files processed */
    filesProcessed: number;
    /** Number of enhancements applied */
    enhancementsApplied: number;
    /** Average RAG score across all files */
    ragScore: number;
    /** Total processing time in milliseconds */
    processingTime: number;
    /** Results from individual agents */
    agentResults: AgentResult[];
    /** Processing summary */
    summary: ProcessingSummary;
  }
  
  export interface AgentResult {
    /** Name of the agent */
    agentName: string;
    /** Role/description of the agent */
    agentRole: string;
    /** Agent processing result */
    result: any;
    /** Time taken by this agent */
    processingTime: number;
    /** Whether content was modified */
    contentModified: boolean;
    /** Position in processing sequence */
    sequencePosition: number;
    /** Error if agent failed */
    error?: string;
  }
  
  export interface ProcessingSummary {
    /** Total files discovered */
    totalFiles: number;
    /** Successfully processed files */
    successful: number;
    /** Failed processing count */
    failed: number;
    /** Average RAG score */
    averageRagScore: number;
    /** Top improvements made */
    topImprovements?: Improvement[];
    /** Top added metadata fields */
    topAddedFields?: AddedField[];
  }
  
  export interface Improvement {
    /** Type of improvement */
    type: string;
    /** Number of files this improvement was applied to */
    count: number;
    /** Description of the improvement */
    description?: string;
  }
  
  export interface AddedField {
    /** Name of the metadata field */
    field: string;
    /** Number of files this field was added to */
    count: number;
    /** Sample value for this field */
    sampleValue?: any;
  }
  
  export interface DocumentInfo {
    /** Relative path to the document */
    path: string;
    /** Full absolute path */
    fullPath: string;
    /** Document title */
    title: string;
    /** Document content (without frontmatter) */
    content: string;
    /** Parsed frontmatter */
    frontmatter: Record<string, any>;
    /** Word count */
    wordCount: number;
    /** Original content with frontmatter */
    originalContent?: string;
  }
  
  export interface EnhancementMetadata {
    /** SEO-related metadata */
    seo?: {
      keywords?: string[];
      description?: string;
      title?: string;
    };
    /** Topic classification */
    topics?: {
      primary?: string;
      secondary?: string[];
      categories?: string[];
    };
    /** Chunking optimization */
    chunking?: {
      optimalChunkSize?: number;
      chunkingScore?: number;
      structureImprovements?: number;
    };
    /** Content research findings */
    research?: {
      relatedTopics?: string[];
      industryTrends?: string[];
      bestPractices?: string[];
    };
    /** Overall RAG score */
    ragScore?: number;
    /** Enhancement timestamp */
    enhancedAt?: string;
    /** Plugin version */
    enhancedBy?: string;
  }
  
  // Re-export from main index for convenience
  export type { RAGPluginOptions as PluginOptions };
  
  ---
  
  // src/utils/envValidation.ts
  import { EnvironmentConfig, EnvValidationResult } from '../types';
  import { LoadContext } from '@docusaurus/types';
  import * as path from 'path';
  import * as fs from 'fs-extra';
  
  /**
   * Environment validation utilities
   */
  
  /**
   * Load environment files in order of preference
   */
  export async function loadEnvironmentFiles(
    context: LoadContext,
    verbose: boolean = false
  ): Promise<void> {
    try {
      const dotenv = require('dotenv');
      const envFiles = ['.env.local', '.env.development.local', '.env.development', '.env'];
  
      for (const envFile of envFiles) {
        const envPath = path.join(context.siteDir, envFile);
        if (await fs.pathExists(envPath)) {
          dotenv.config({ path: envPath });
          if (verbose) {
            console.log(`🔍 [RAG Plugin] Loaded env from: ${envFile}`);
          }
          return; // Stop after loading first available file
        }
      }
  
      if (verbose) {
        console.log('💡 No .env files found, using system environment variables');
      }
    } catch (error) {
      if (verbose) {
        console.warn('⚠️ Error loading environment files:', error.message);
      }
    }
  }
  
  /**
   * Validate all required environment variables
   */
  export function validateEnvironmentVariables(
    options: { skipPrompt?: boolean } = {}
  ): EnvValidationResult {
    const required = ['GOOGLE_API_KEY', 'TAVILY_API_KEY'];
    const optional = ['RAG_SKIP_PROMPT', 'NODE_ENV', 'GITHUB_TOKEN'];
  
    const missing = required.filter(key => !process.env[key]);
    const present = required.filter(key => process.env[key]);
  
    const config: EnvironmentConfig = {
      googleApiKey: process.env.GOOGLE_API_KEY,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      skipPrompt: parseBoolean(process.env.RAG_SKIP_PROMPT) || options.skipPrompt || false,
      nodeEnv: process.env.NODE_ENV || 'development',
      isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
      isProduction: process.env.NODE_ENV === 'production',
    };
  
    return {
      isValid: missing.length === 0,
      missing,
      present: [...present, ...optional.filter(key => process.env[key])],
      config,
    };
  }
  
  /**
   * Parse boolean values from environment variables
   */
  function parseBoolean(value: string | undefined): boolean {
    if (!value) return false;
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  
  /**
   * Get environment configuration with validation
   */
  export function getEnvironmentConfig(): EnvironmentConfig {
    const result = validateEnvironmentVariables();
    return result.config;
  }
  
  /**
   * Check if all required environment variables are available
   */
  export function hasRequiredEnvironmentVariables(): boolean {
    const result = validateEnvironmentVariables();
    return result.isValid;
  }
  
  /**
   * Get missing environment variables
   */
  export function getMissingEnvironmentVariables(): string[] {
    const result = validateEnvironmentVariables();
    return result.missing;
  }
  
  /**
   * Pretty print environment validation results
   */
  export function printEnvironmentStatus(verbose: boolean = false): void {
    const result = validateEnvironmentVariables();
    
    if (result.isValid) {
      console.log('✅ All required environment variables are present');
      if (verbose && result.present.length > 0) {
        console.log('📋 Available variables:', result.present.join(', '));
      }
    } else {
      console.warn('⚠️ Missing required environment variables:', result.missing.join(', '));
      console.log('💡 Add these to your .env.local file:');
      result.missing.forEach(variable => {
        console.log(`   ${variable}=your_${variable.toLowerCase()}_here`);
      });
    }
  
    if (verbose) {
      console.log('🔧 Environment configuration:');
      console.log(`   - Node Environment: ${result.config.nodeEnv}`);
      console.log(`   - Development Mode: ${result.config.isDevelopment}`);
      console.log(`   - Skip Prompt: ${result.config.skipPrompt}`);
    }
  }
  
  ---
  
  // src/utils/promptUtils.ts
  import { EnvironmentConfig } from '../types';
  
  /**
   * Interactive prompt utilities for development mode
   */
  
  /**
   * Create interactive prompt for user input
   */
  export async function createInteractivePrompt(): Promise<boolean> {
    const readline = require('readline');
  
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    console.log('\n📋 RAG Documentation Enhancement Plugin');
    console.log('💡 This will run AI agents to analyze and enhance documentation');
    console.log('⚡ Tip: Set RAG_SKIP_PROMPT=true in .env.local to always skip this prompt');
  
    return new Promise((resolve) => {
      rl.question(
        '🤖 Do you want to run RAG documentation enhancement? (y/N): ',
        (answer) => {
          rl.close();
          const shouldRun = answer.toLowerCase().trim() === 'y';
          
          if (shouldRun) {
            console.log('✅ Starting RAG enhancement workflow...');
          } else {
            console.log('⏭️ Skipping RAG enhancement (faster startup)');
            console.log('💡 You can run it later by restarting with "y" when prompted');
          }
          
          resolve(shouldRun);
        }
      );
    });
  }
  
  /**
   * Determine if processing should run based on environment and configuration
   */
  export async function shouldRunProcessing(
    config: EnvironmentConfig,
    forceSkipPrompt: boolean = false,
    verbose: boolean = false
  ): Promise<boolean> {
    // Always run in production
    if (config.isProduction) {
      if (verbose) {
        console.log('🚀 RAG Prep Plugin starting (production mode)...');
      }
      return true;
    }
  
    // Skip prompt if configured
    if (config.skipPrompt || forceSkipPrompt) {
      if (verbose) {
        console.log('⏭️ Skipping RAG enhancement (skipPrompt=true)');
      }
      return false;
    }
  
    // Show interactive prompt in development
    return await createInteractivePrompt();
  }
  
  /**
   * Create a simple yes/no prompt
   */
  export async function createYesNoPrompt(question: string, defaultValue: boolean = false): Promise<boolean> {
    const readline = require('readline');
  
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  
    const defaultText = defaultValue ? '(Y/n)' : '(y/N)';
  
    return new Promise((resolve) => {
      rl.question(`${question} ${defaultText}: `, (answer) => {
        rl.close();
        
        if (!answer.trim()) {
          resolve(defaultValue);
          return;
        }
  
        const normalizedAnswer = answer.toLowerCase().trim();
        const shouldRun = normalizedAnswer === 'y' || normalizedAnswer === 'yes';
        resolve(shouldRun);
      });
    });
  }
  