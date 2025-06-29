import { EnvironmentConfig, EnvValidationResult } from '../types'
import * as path from 'path'
import * as fs from 'fs-extra'

/**
 * Load environment files in order of preference
 */
export async function loadEnvironmentFiles(
  siteDir: string,
  verbose: boolean = false,
): Promise<void> {
  try {
    const dotenv = require('dotenv')
    const envFiles = [
      '.env.local',
      '.env.development.local',
      '.env.development',
      '.env',
    ]

    for (const envFile of envFiles) {
      const envPath = path.join(siteDir, envFile)
      if (await fs.pathExists(envPath)) {
        dotenv.config({ path: envPath })
        if (verbose) {
          console.log(`🔍 [RAG Plugin] Loaded env from: ${envFile}`)
        }
        return // Stop after loading first available file
      }
    }

    if (verbose) {
      console.log('💡 No .env files found, using system environment variables')
    }
  } catch (error) {
    if (verbose) {
      console.warn('⚠️ Error loading environment files:', error.message)
    }
  }
}

/**
 * Validate all required environment variables
 */
export function validateEnvironmentVariables(
  options: { skipPrompt?: boolean } = {},
): EnvValidationResult {
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
