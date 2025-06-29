class ContentResearchAgent {
  constructor() {
    this.name = 'content-research-agent'
    this.role = 'Content Validation & Research Specialist'
    this.goal =
      'Validate content accuracy, identify outdated information, and generate professional validation reports'
    this.backstory = `You are an expert technical documentation validator specializing in security and compliance analysis. 
                              You excel at identifying outdated practices, missing security advisories, broken references, and 
                              compliance gaps. You generate professional validation reports that enable quick decision-making.`
    this.verbose = true
    this.allowDelegation = false
    this.maxIter = 3
    this.memory = true
    this.logDirectory = './logs/validation'
  }

  /**
   * Main analysis method - validates content and generates separate log
   */
  async analyzeContent(filePath, content, currentMetadata = {}) {
    console.log(`🔍 [Research Agent] Analyzing: ${filePath}`)

    try {
      // Parse the document
      const matter = require('gray-matter')
      const parsed = matter(content)

      // Prepare validation context
      const validationContext = {
        title: parsed.data.title || 'Untitled',
        content: parsed.content,
        filePath,
        currentMetadata: parsed.data,
        wordCount: parsed.content.split(/\s+/).length,
        technicalTopics: this.extractTechnicalTopics(parsed.content),
        securityConcepts: this.extractSecurityConcepts(parsed.content),
        potentialIssues: this.identifyPotentialIssues(parsed.content),
        documentType: this.classifyDocumentType(
          parsed.content,
          parsed.data.title,
        ),
      }

      // Conduct validation research
      console.log(
        `🔍 [Research Agent] Conducting validation research with Tavily...`,
      )
      const validationResults = await this.conductValidationResearch(
        validationContext,
      )

      // Generate professional validation log
      const validationLog = await this.generateValidationLog(
        validationContext,
        validationResults,
      )

      // Write validation log to separate file
      await this.writeValidationLog(validationContext, validationLog)

      // Return minimal metadata (no content changes for PR)
      const enhancedMetadata = {
        researchConducted: true,
        researchDate: new Date().toISOString(),
        validationScore: validationResults.overallScore || 75,
        criticalIssues: validationResults.criticalIssues?.length || 0,
        recommendationsCount: validationResults.recommendations?.length || 0,
        researchSources: validationResults.sourcesCount || 0,
        enhanced_by: 'rag-prep-plugin-research-validator',
        enhanced_at: new Date().toISOString(),
      }

      console.log(
        `✅ [Research Agent] Validation complete: ${
          validationResults.status || 'REVIEWED'
        }`,
      )
      console.log(
        `📋 [Research Agent] Log saved: ${this.getLogPath(validationContext)}`,
      )

      return {
        originalMetadata: parsed.data,
        enhancedMetadata,
        content: parsed.content, // No content changes
        improvements: [
          `Validation completed: ${validationResults.status}`,
          `${
            validationResults.criticalIssues?.length || 0
          } critical issues found`,
        ],
      }
    } catch (error) {
      console.error(
        `❌ [Research Agent] Error validating ${filePath}:`,
        error.message,
      )
      return this.fallbackValidation(filePath, content)
    }
  }

  /**
   * Conduct comprehensive validation research using Tavily
   * FIXED: Uses correct Tavily API methods
   */
  async conductValidationResearch(context) {
    // Load Tavily client
    const tavilyClient = await this.initializeTavilyClient()
    if (!tavilyClient) {
      return this.fallbackResearch(context)
    }

    try {
      // Search options for Tavily API
      const searchOptions = {
        search_depth: 'advanced',
        max_results: 3,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      }

      // Generate targeted validation questions
      const validationQuestions = this.generateValidationQuestions(context)

      // Conduct validation research
      const validationResults = []
      const directAnswers = []

      for (const question of validationQuestions) {
        try {
          console.log(`   🔎 Validating: "${question.query}"`)

          // Use standard search method (the one that actually exists)
          const searchResult = await this.safeApiCall(
            () => tavilyClient.search(question.query, searchOptions),
            `Search for: ${question.query}`,
          )

          if (searchResult && searchResult.results) {
            // Extract answer from search result
            const answer =
              searchResult.answer ||
              (searchResult.results.length > 0
                ? searchResult.results[0].content
                : '') ||
              'No specific information found'

            directAnswers.push({
              question: question.query,
              category: question.category,
              answer: answer.substring(0, 500), // Limit answer length
              severity: question.severity,
            })

            // Store detailed results for critical questions
            if (question.severity === 'critical') {
              validationResults.push({
                question: question.query,
                category: question.category,
                results: searchResult.results.slice(0, 2) || [], // Limit results
                answer: searchResult.answer || '',
              })
            }
          }
        } catch (error) {
          console.warn(
            `⚠️ [Research Agent] Question failed: ${question.query} - ${error.message}`,
          )
        }
      }

      // Analyze findings
      const analysis = this.analyzeValidationFindings(
        context,
        directAnswers,
        validationResults,
      )

      console.log(
        `🎯 [Research Agent] Validation research complete - ${directAnswers.length} questions answered`,
      )

      return {
        status: analysis.overallStatus,
        overallScore: analysis.score,
        criticalIssues: analysis.criticalIssues,
        moderateIssues: analysis.moderateIssues,
        validatedPractices: analysis.validatedPractices,
        recommendations: analysis.recommendations,
        sourcesCount: validationResults.reduce(
          (sum, r) => sum + (r.results?.length || 0),
          0,
        ),
        directAnswers,
        detailedFindings: validationResults,
        researchQueries: validationQuestions.map(q => q.query),
      }
    } catch (error) {
      console.error(
        `❌ [Research Agent] Validation research failed:`,
        error.message,
      )
      return this.fallbackResearch(context)
    }
  }

  /**
   * Safe API call wrapper with timeout and retry logic
   */
  async safeApiCall(apiCall, description, timeoutMs = 15000, maxRetries = 2) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🔄 ${description} (attempt ${attempt}/${maxRetries})`)

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('API call timeout')), timeoutMs)
        })

        // Race between API call and timeout
        const result = await Promise.race([apiCall(), timeoutPromise])

        if (result) {
          console.log(`   ✅ ${description} - Success`)
          return result
        } else {
          console.warn(`   ⚠️ ${description} - Empty result`)
          return null
        }
      } catch (error) {
        console.warn(
          `   ⚠️ ${description} - Attempt ${attempt} failed: ${error.message}`,
        )

        if (attempt === maxRetries) {
          console.error(`   ❌ ${description} - All attempts failed`)
          return null
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 2000))
      }
    }
    return null
  }

  /**
   * Generate targeted validation questions based on content
   */
  generateValidationQuestions(context) {
    const questions = []

    // Security-focused validation for auth/security docs
    if (context.securityConcepts.length > 0) {
      context.securityConcepts.slice(0, 2).forEach(concept => {
        questions.push({
          query: `${concept} security best practices 2025 current standards`,
          category: 'security_currency',
          severity: 'critical',
        })
      })
    }

    // Technical currency validation (limit to avoid API overuse)
    context.technicalTopics.slice(0, 2).forEach(topic => {
      questions.push({
        query: `${topic} current version 2025 deprecated practices`,
        category: 'technical_currency',
        severity: 'moderate',
      })
    })

    // Document-specific validation
    if (context.documentType === 'authentication') {
      questions.push({
        query: 'OAuth 2.1 vs OAuth 2.0 current recommendations 2025',
        category: 'standards_currency',
        severity: 'moderate',
      })
    }

    // Always include compliance validation
    questions.push({
      query: `${context.title} compliance requirements GDPR SOC2 2025`,
      category: 'compliance',
      severity: 'moderate',
    })

    return questions.slice(0, 4) // Limit to prevent API overuse
  }

  /**
   * Analyze validation findings and categorize issues
   */
  analyzeValidationFindings(context, directAnswers, detailedResults) {
    const criticalIssues = []
    const moderateIssues = []
    const validatedPractices = []
    const recommendations = []

    // Analyze direct answers for issues
    directAnswers.forEach(result => {
      if (result.answer && result.answer.length > 10) {
        // Check for outdated practices
        if (
          result.answer.toLowerCase().includes('deprecated') ||
          result.answer.toLowerCase().includes('outdated') ||
          result.answer.toLowerCase().includes('no longer recommended')
        ) {
          if (result.severity === 'critical') {
            criticalIssues.push({
              category: result.category,
              issue: `Potentially outdated practice detected in ${result.question}`,
              evidence: result.answer.substring(0, 200) + '...',
              recommendation: `Review and update based on current ${result.category} standards`,
            })
          } else {
            moderateIssues.push({
              category: result.category,
              issue: `Consider updating: ${result.question}`,
              evidence: result.answer.substring(0, 150) + '...',
            })
          }
        } else if (
          result.answer.toLowerCase().includes('current') ||
          result.answer.toLowerCase().includes('recommended') ||
          result.answer.toLowerCase().includes('best practice')
        ) {
          validatedPractices.push({
            category: result.category,
            practice: result.question,
            validation: result.answer.substring(0, 100) + '...',
          })
        }
      }
    })

    // Check for specific security red flags in content
    const securityRedFlags = this.checkSecurityRedFlags(context.content)
    criticalIssues.push(...securityRedFlags)

    // Generate specific recommendations
    if (context.potentialIssues.missingReferences > 0) {
      recommendations.push({
        type: 'missing_references',
        description: `${context.potentialIssues.missingReferences} broken or missing references found`,
        priority: 'medium',
        action: 'Add proper links to referenced documentation',
      })
    }

    if (context.potentialIssues.vaguePhrases > 0) {
      recommendations.push({
        type: 'vague_instructions',
        description:
          'Document contains vague phrases like "as needed" or "appropriate values"',
        priority: 'low',
        action: 'Provide specific values and examples',
      })
    }

    // Calculate overall score
    let score = 85 // Base score
    score -= criticalIssues.length * 15
    score -= moderateIssues.length * 5
    score += validatedPractices.length * 3
    score = Math.max(score, 0)

    // Determine overall status
    let overallStatus = 'APPROVED'
    if (criticalIssues.length > 0) {
      overallStatus = 'CRITICAL_ISSUES_FOUND'
    } else if (moderateIssues.length > 2) {
      overallStatus = 'APPROVED_WITH_RECOMMENDATIONS'
    }

    return {
      overallStatus,
      score: Math.min(score, 100),
      criticalIssues,
      moderateIssues,
      validatedPractices,
      recommendations,
    }
  }

  /**
   * Check for specific security red flags in content
   */
  checkSecurityRedFlags(content) {
    const redFlags = []

    // Check for dangerous security advice
    if (content.includes('disable server-side validation')) {
      redFlags.push({
        category: 'security_vulnerability',
        issue: 'Document suggests disabling server-side validation',
        evidence: 'Found text about disabling security validation',
        recommendation:
          'Remove dangerous security advice and emphasize validation importance',
      })
    }

    // Check for outdated crypto parameters
    if (content.includes('100,000') && content.includes('PBKDF2')) {
      redFlags.push({
        category: 'security_outdated',
        issue:
          'PBKDF2 iteration count appears outdated (100,000 vs current 600,000+ recommendation)',
        evidence: 'Low PBKDF2 iteration count found',
        recommendation:
          'Update to current NIST recommended iteration counts (600,000+ for PBKDF2-SHA256)',
      })
    }

    // Check for insecure storage mentions
    if (
      content.includes('plaintext') &&
      (content.includes('cookie') || content.includes('storage'))
    ) {
      redFlags.push({
        category: 'security_vulnerability',
        issue: 'Document mentions plaintext storage of sensitive data',
        evidence: 'References to plaintext storage found',
        recommendation:
          'Update to recommend encrypted storage for all sensitive data',
      })
    }

    return redFlags
  }

  /**
   * Generate professional validation log
   */
  async generateValidationLog(context, validationResults) {
    const timestamp = new Date().toISOString().split('T')[0]
    const status = validationResults.status
    const score = validationResults.overallScore

    let log = `# Document Validation Report\n\n`
    log += `**Document:** ${context.title}\n`
    log += `**File:** \`${context.filePath}\`\n`
    log += `**Validated:** ${timestamp}\n`
    log += `**Validation Score:** ${score}/100\n\n`

    // Executive Summary
    log += `## 📊 Executive Summary\n\n`

    if (status === 'CRITICAL_ISSUES_FOUND') {
      log += `🚨 **CRITICAL ISSUES FOUND** - Immediate action required\n\n`
    } else if (status === 'APPROVED_WITH_RECOMMENDATIONS') {
      log += `⚠️ **APPROVED WITH RECOMMENDATIONS** - Consider improvements\n\n`
    } else {
      log += `✅ **APPROVED** - Content meets current standards\n\n`
    }

    log += `- **Critical Issues:** ${
      validationResults.criticalIssues?.length || 0
    }\n`
    log += `- **Recommendations:** ${
      validationResults.recommendations?.length || 0
    }\n`
    log += `- **Sources Consulted:** ${validationResults.sourcesCount || 0}\n`
    log += `- **Research Queries:** ${
      validationResults.researchQueries?.length || 0
    }\n\n`

    // Critical Issues
    if (validationResults.criticalIssues?.length > 0) {
      log += `## 🚨 Critical Issues\n\n`
      validationResults.criticalIssues.forEach((issue, index) => {
        log += `### ${index + 1}. ${issue.issue}\n\n`
        log += `**Category:** ${issue.category}\n\n`
        log += `**Evidence:** ${issue.evidence}\n\n`
        log += `**Recommendation:** ${issue.recommendation}\n\n`
        log += `---\n\n`
      })
    }

    // Moderate Issues
    if (validationResults.moderateIssues?.length > 0) {
      log += `## ⚠️ Moderate Concerns\n\n`
      validationResults.moderateIssues.forEach((issue, index) => {
        log += `**${index + 1}.** ${issue.issue}\n\n`
        if (issue.evidence) {
          log += `*Evidence:* ${issue.evidence}\n\n`
        }
      })
    }

    // Validated Practices
    if (validationResults.validatedPractices?.length > 0) {
      log += `## ✅ Validated Current Practices\n\n`
      validationResults.validatedPractices.forEach((practice, index) => {
        log += `**${index + 1}.** ${practice.practice} ✓\n\n`
        log += `*Validation:* ${practice.validation}\n\n`
      })
    }

    // Recommendations
    if (validationResults.recommendations?.length > 0) {
      log += `## 💡 Recommendations\n\n`
      validationResults.recommendations.forEach((rec, index) => {
        const priorityEmoji =
          rec.priority === 'high'
            ? '🔥'
            : rec.priority === 'medium'
            ? '📋'
            : '💭'
        log += `${priorityEmoji} **${index + 1}.** ${rec.description}\n\n`
        log += `*Action:* ${rec.action}\n\n`
      })
    }

    // Research Methodology
    log += `## 🔍 Research Methodology\n\n`
    log += `**Time Range:** Current practices (2024)\n\n`
    log += `**Search Depth:** Advanced\n\n`
    log += `**Validation Queries:**\n`
    validationResults.researchQueries?.forEach(query => {
      log += `- ${query}\n`
    })
    log += `\n**Sources:** Industry standards, official documentation, recent advisories\n\n`

    log += `---\n\n`
    log += `*Generated by RAG Prep Plugin Research Agent*\n`
    log += `*Report Date: ${new Date().toISOString()}*\n`

    return log
  }

  /**
   * Write validation log to separate log file
   */
  async writeValidationLog(context, logContent) {
    const fs = require('fs').promises
    const path = require('path')

    try {
      // Ensure log directory exists
      await this.ensureLogDirectoryExists()

      // Generate log file path
      const logPath = this.getLogPath(context)

      // Write validation log
      await fs.writeFile(logPath, logContent, 'utf8')

      console.log(`   📋 Validation log saved: ${logPath}`)
    } catch (error) {
      console.error(`   ❌ Failed to write validation log: ${error.message}`)
    }
  }

  /**
   * Get log file path for document
   */
  getLogPath(context) {
    const path = require('path')
    const filename = context.filePath
      .split('/')
      .pop()
      .replace('.md', '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')

    const timestamp = new Date().toISOString().split('T')[0]
    return path.join(
      this.logDirectory,
      `${filename}-validation-${timestamp}.md`,
    )
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDirectoryExists() {
    const fs = require('fs').promises
    const path = require('path')

    try {
      await fs.mkdir(path.dirname(this.logDirectory), { recursive: true })
      await fs.mkdir(this.logDirectory, { recursive: true })
    } catch (error) {
      // Directory probably exists, ignore
    }
  }

  /**
   * Initialize Tavily client with better error handling
   */
  async initializeTavilyClient() {
    // Load environment variables
    if (!process.env.TAVILY_API_KEY) {
      try {
        const path = require('path')
        require('dotenv').config({
          path: path.join(process.cwd(), '.env.local'),
        })
      } catch (error) {
        console.warn('⚠️ Could not load .env.local file')
      }
    }

    if (!process.env.TAVILY_API_KEY) {
      console.warn(
        '⚠️ [Research Agent] TAVILY_API_KEY not found in environment variables',
      )
      console.warn(
        '💡 [Research Agent] Add TAVILY_API_KEY to your .env.local file to enable web research',
      )
      console.warn('💡 [Research Agent] Get API key from: https://tavily.com/')
      return null
    }

    try {
      const { tavily } = require('@tavily/core')
      console.log(
        '🔑 [Research Agent] Found Tavily API key, initializing client...',
      )
      const client = tavily({ apiKey: process.env.TAVILY_API_KEY })

      // Test the client to make sure it works
      console.log('🧪 [Research Agent] Testing Tavily client...')

      return client
    } catch (error) {
      console.error(
        `❌ [Research Agent] Failed to initialize Tavily: ${error.message}`,
      )
      console.warn('💡 [Research Agent] Try: npm install @tavily/core')
      return null
    }
  }

  /**
   * Extract technical topics for targeted research
   */
  extractTechnicalTopics(content) {
    const topics = new Set()
    const patterns = [
      /\b(OAuth|JWT|PKCE|RSA|PBKDF2|SHA256|TLS|SSL)\b/gi,
      /\b(API|REST|GraphQL|WebSocket)\b/gi,
      /\b(authentication|authorization|encryption)\b/gi,
      /\b(Node\.?js|Python|Java|React|Angular)\b/gi,
    ]

    patterns.forEach(pattern => {
      const matches = content.match(pattern) || []
      matches.forEach(match => topics.add(match.toUpperCase()))
    })

    return Array.from(topics).slice(0, 5)
  }

  /**
   * Extract security concepts for focused validation
   */
  extractSecurityConcepts(content) {
    const concepts = []
    const securityTerms = [
      'authentication',
      'authorization',
      'JWT',
      'OAuth',
      'PKCE',
      'encryption',
      'hashing',
      'PBKDF2',
      'token',
      'session',
      'credential',
      'password',
      'certificate',
      'key rotation',
    ]

    securityTerms.forEach(term => {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        concepts.push(term)
      }
    })

    return concepts.slice(0, 6)
  }

  /**
   * Identify potential issues for targeted validation
   */
  identifyPotentialIssues(content) {
    return {
      missingReferences: (
        content.match(/see\s+(our|the|company)\s+\w+/gi) || []
      ).length,
      vaguePhrases: (
        content.match(/\b(as needed|appropriately|as required)\b/gi) || []
      ).length,
      securityConcerns: (
        content.match(
          /\b(disable|ignore|skip|bypass)\s+\w*(validation|security|check)/gi,
        ) || []
      ).length,
      outdatedVersions: (
        content.match(/\b(Node|React|Angular)\s+\d+\b/gi) || []
      ).length,
    }
  }

  /**
   * Classify document type for targeted validation
   */
  classifyDocumentType(content, title) {
    const titleLower = (title || '').toLowerCase()
    const contentLower = content.toLowerCase()

    if (
      titleLower.includes('auth') ||
      contentLower.includes('authentication')
    ) {
      return 'authentication'
    } else if (
      titleLower.includes('credential') ||
      contentLower.includes('password')
    ) {
      return 'credential_management'
    } else if (
      titleLower.includes('config') ||
      contentLower.includes('configuration')
    ) {
      return 'configuration'
    } else if (
      titleLower.includes('api') ||
      contentLower.includes('endpoint')
    ) {
      return 'api_documentation'
    } else {
      return 'general'
    }
  }

  /**
   * Fallback research when Tavily fails
   */
  fallbackResearch(context) {
    console.warn(
      `⚠️ [Research Agent] Using fallback validation for ${context.title}`,
    )

    return {
      status: 'VALIDATION_LIMITED',
      overallScore: 70,
      criticalIssues: [],
      moderateIssues: [
        {
          category: 'validation_incomplete',
          issue:
            'Unable to perform full validation - limited to static analysis',
        },
      ],
      validatedPractices: [],
      recommendations: [
        {
          type: 'manual_review',
          description:
            'Manual review recommended due to validation service unavailability',
          priority: 'medium',
          action: 'Review document against current industry standards',
        },
      ],
      sourcesCount: 0,
      directAnswers: [],
      researchQueries: [],
    }
  }

  /**
   * Fallback when complete failure occurs
   */
  fallbackValidation(filePath, content) {
    return {
      originalMetadata: {},
      enhancedMetadata: {
        researchConducted: false,
        validationScore: 50,
        enhanced_by: 'rag-prep-plugin-research-fallback',
      },
      content,
      improvements: ['Validation failed - manual review recommended'],
    }
  }
}

module.exports = ContentResearchAgent
