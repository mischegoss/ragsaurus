class TopicTaxonomyAgent {
  constructor() {
    this.name = 'topic-taxonomy-agent'
    this.role = 'Content Categorization Specialist'
    this.goal =
      'Generate structured topic taxonomies and content categorization for improved RAG organization and discovery'
    this.backstory = `You are an expert information architect specializing in content taxonomy and knowledge organization. 
                      You excel at analyzing technical content to identify main topics, subtopics, difficulty levels, 
                      target audiences, and learning prerequisites. You create hierarchical topic structures that help 
                      AI systems understand content relationships and organize information for optimal retrieval.
                      Your taxonomies balance technical precision with practical usability.`
    this.verbose = true
    this.allowDelegation = false
    this.maxIter = 3
    this.memory = true
  }

  /**
   * Analyze document content and generate topic taxonomy
   */
  async analyzeContent(filePath, content, currentMetadata = {}) {
    console.log(`🏷️ [Taxonomy Agent] Analyzing: ${filePath}`)

    try {
      // Parse the document to separate content from frontmatter
      const matter = require('gray-matter')
      const parsed = matter(content)

      // Prepare analysis context
      const analysisContext = {
        title: parsed.data.title || 'Untitled',
        content: parsed.content,
        currentMetadata: parsed.data,
        wordCount: parsed.content.split(/\s+/).length,
        headings: this.extractHeadings(parsed.content),
        codeBlocks: this.extractCodeBlocks(parsed.content),
        technicalTerms: this.extractTechnicalTerms(parsed.content),
        procedureSteps: this.extractProcedureSteps(parsed.content),
        existingKeywords: parsed.data.keywords || [],
      }

      // Generate topic taxonomy using Gemini
      const taxonomyMetadata = await this.generateTopicTaxonomy(analysisContext)

      console.log(
        `✅ [Taxonomy Agent] Generated topic taxonomy for: ${filePath}`,
      )

      return {
        originalMetadata: parsed.data,
        enhancedMetadata: taxonomyMetadata,
        content: parsed.content,
        improvements: this.identifyImprovements(parsed.data, taxonomyMetadata),
      }
    } catch (error) {
      console.error(
        `❌ [Taxonomy Agent] Error analyzing ${filePath}:`,
        error.message,
      )
      throw error
    }
  }

  /**
   * Extract headings with semantic analysis
   */
  extractHeadings(content) {
    const headingMatches = content.match(/^#+\s+(.+)$/gm) || []
    return headingMatches.map(heading => {
      const level = (heading.match(/^#+/) || [''])[0].length
      const text = heading
        .replace(/^#+\s+/, '')
        .replace(/[#*`]/g, '')
        .trim()
      return { level, text }
    })
  }

  /**
   * Extract code blocks and identify technologies
   */
  extractCodeBlocks(content) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    const blocks = []
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'unknown',
        code: match[2].trim(),
      })
    }

    return blocks
  }

  /**
   * Extract technical terms and concepts
   */
  extractTechnicalTerms(content) {
    // Common technical term patterns
    const patterns = [
      /\b[A-Z]{2,}(?:[A-Z][a-z]+)*\b/g, // Acronyms like API, JWT, OAuth
      /\b\w+(?:js|JS|\.js)\b/g, // JavaScript files/libraries
      /\b\w+(?:SQL|DB|Database)\b/gi, // Database terms
      /\b(?:HTTP|HTTPS|REST|GraphQL|gRPC)\b/gi, // Protocol terms
      /\b\w+(?:Auth|Authentication|Authorization)\b/gi, // Auth terms
    ]

    const terms = new Set()
    patterns.forEach(pattern => {
      const matches = content.match(pattern) || []
      matches.forEach(match => terms.add(match.toLowerCase()))
    })

    return Array.from(terms).slice(0, 10) // Limit to top 10
  }

  /**
   * Extract procedure steps and workflow indicators
   */
  extractProcedureSteps(content) {
    const stepPatterns = [
      /^\d+\.\s+/gm, // Numbered steps
      /^-\s+/gm, // Bullet points
      /(?:first|second|third|next|then|finally|lastly)/gi, // Step indicators
      /(?:step|phase|stage)\s+\d+/gi, // Explicit step mentions
    ]

    let stepCount = 0
    stepPatterns.forEach(pattern => {
      const matches = content.match(pattern) || []
      stepCount += matches.length
    })

    return {
      hasSteps: stepCount > 2,
      stepCount: stepCount,
      isProcedural: stepCount > 5,
    }
  }

  /**
   * Generate comprehensive topic taxonomy using Gemini AI
   */
  async generateTopicTaxonomy(context) {
    // Try to load environment variables if not already loaded
    if (!process.env.GOOGLE_API_KEY) {
      try {
        const path = require('path')
        require('dotenv').config({
          path: path.join(process.cwd(), '.env.local'),
        })
      } catch (error) {
        console.warn('⚠️  Could not load .env.local file')
      }
    }

    if (!process.env.GOOGLE_API_KEY) {
      console.error(
        '❌ [Taxonomy Agent] GOOGLE_API_KEY not found in environment variables',
      )
      throw new Error('GOOGLE_API_KEY not found in environment variables')
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = this.buildTaxonomyPrompt(context)

    try {
      console.log(`🤖 [Taxonomy Agent] Calling Gemini for taxonomy analysis...`)
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      // Clean the response
      let cleanedText = text.trim()
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '')
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      // Parse the JSON response from Gemini
      const taxonomyMetadata = JSON.parse(cleanedText)

      // Validate and clean the metadata
      const validatedMetadata = this.validateAndCleanTaxonomy(taxonomyMetadata)

      console.log(`🎯 [Taxonomy Agent] Taxonomy analysis complete`)
      return validatedMetadata
    } catch (error) {
      console.error('❌ [Taxonomy Agent] Gemini API error:', error.message)
      // Fallback to basic taxonomy analysis if Gemini fails
      return this.fallbackTaxonomyAnalysis(context)
    }
  }

  /**
   * Build the taxonomy analysis prompt for Gemini
   */
  buildTaxonomyPrompt(context) {
    return `You are an expert information architect and content taxonomist. Analyze this technical document and create a comprehensive topic taxonomy that will help organize content for optimal retrieval and understanding.
  
  DOCUMENT TO ANALYZE:
  Title: ${context.title}
  Word Count: ${context.wordCount}
  Headings: ${context.headings
    .map(h => `${'#'.repeat(h.level)} ${h.text}`)
    .join('\n')}
  ${
    context.codeBlocks.length > 0
      ? `Programming Languages: ${[
          ...new Set(context.codeBlocks.map(b => b.language)),
        ].join(', ')}`
      : ''
  }
  ${
    context.technicalTerms.length > 0
      ? `Technical Terms: ${context.technicalTerms.join(', ')}`
      : ''
  }
  ${
    context.procedureSteps.hasSteps
      ? `Contains Procedures: ${context.procedureSteps.stepCount} steps`
      : ''
  }
  
  CONTENT:
  ${context.content.substring(0, 2500)}${
      context.content.length > 2500 ? '...' : ''
    }
  
  CURRENT METADATA:
  ${JSON.stringify(context.currentMetadata, null, 2)}
  
  Generate comprehensive topic taxonomy as valid JSON:
  
  {
    "primaryTopic": "main-subject-area",
    "topics": ["primary-topic", "secondary-topic", "related-topic"],
    "categories": ["content-type", "domain-area"],
    "subCategories": ["specific-area", "specialized-domain"],
    "difficulty": "beginner|intermediate|advanced|expert",
    "complexity": "low|medium|high|very-high",
    "audience": ["developers", "system-administrators", "beginners", "architects"],
    "targetRoles": ["backend-developer", "devops-engineer", "security-specialist"],
    "prerequisites": ["basic-programming", "api-knowledge", "authentication-concepts"],
    "learningPath": ["foundational-concepts", "intermediate-topics", "advanced-implementation"],
    "contentType": "tutorial|reference|guide|overview|troubleshooting|api-docs",
    "domainArea": "security|development|infrastructure|integration|configuration",
    "conceptLevel": "introduction|implementation|optimization|troubleshooting",
    "technicalDepth": "surface|detailed|comprehensive|expert",
    "industryTags": ["enterprise", "startup", "security-critical", "high-scale"],
    "useCases": ["authentication-setup", "security-hardening", "api-integration"],
    "relatedConcepts": ["oauth", "jwt", "session-management", "security-policies"],
    "taxonomyScore": 85
  }
  
  TAXONOMY REQUIREMENTS:
  - Primary topic should be the main subject (1-2 words)
  - Topics should be hierarchical (broad to specific)
  - Categories should reflect content type and domain
  - Difficulty should match technical complexity and assumed knowledge
  - Audience should be specific and actionable
  - Prerequisites should be concrete and verifiable
  - Use consistent terminology across similar content
  - Balance specificity with discoverability
  - Consider both novice and expert perspectives
  
  Return ONLY valid JSON, no markdown formatting, no code blocks.`
  }

  /**
   * Validate and clean taxonomy metadata
   */
  validateAndCleanTaxonomy(metadata) {
    const cleaned = { ...metadata }

    // Ensure arrays are clean and reasonably sized
    const arrayFields = [
      'topics',
      'categories',
      'subCategories',
      'audience',
      'targetRoles',
      'prerequisites',
      'learningPath',
      'industryTags',
      'useCases',
      'relatedConcepts',
    ]

    arrayFields.forEach(field => {
      if (cleaned[field] && Array.isArray(cleaned[field])) {
        cleaned[field] = cleaned[field]
          .filter(item => item && typeof item === 'string' && item.trim())
          .map(item => item.trim().toLowerCase().replace(/"/g, "'"))
          .slice(0, 6) // Limit to 6 items max
      }
    })

    // Ensure required fields have defaults
    if (!cleaned.topics || cleaned.topics.length === 0) {
      cleaned.topics = ['documentation']
    }

    if (!cleaned.categories || cleaned.categories.length === 0) {
      cleaned.categories = ['general']
    }

    if (!cleaned.audience || cleaned.audience.length === 0) {
      cleaned.audience = ['developers']
    }

    // Validate enum fields
    const validDifficulties = ['beginner', 'intermediate', 'advanced', 'expert']
    if (!validDifficulties.includes(cleaned.difficulty)) {
      cleaned.difficulty = 'intermediate' // Safe default
    }

    const validComplexities = ['low', 'medium', 'high', 'very-high']
    if (!validComplexities.includes(cleaned.complexity)) {
      cleaned.complexity = 'medium' // Safe default
    }

    const validContentTypes = [
      'tutorial',
      'reference',
      'guide',
      'overview',
      'troubleshooting',
      'api-docs',
    ]
    if (!validContentTypes.includes(cleaned.contentType)) {
      cleaned.contentType = 'guide' // Safe default
    }

    // Validate numeric fields
    if (!cleaned.taxonomyScore || isNaN(cleaned.taxonomyScore)) {
      cleaned.taxonomyScore = 75 // Default score
    }

    // Ensure string fields are clean
    const stringFields = [
      'primaryTopic',
      'domainArea',
      'conceptLevel',
      'technicalDepth',
    ]
    stringFields.forEach(field => {
      if (cleaned[field] && typeof cleaned[field] === 'string') {
        cleaned[field] = cleaned[field].trim().toLowerCase().replace(/"/g, "'")
      }
    })

    return cleaned
  }

  /**
   * Fallback taxonomy analysis if Gemini fails
   */
  fallbackTaxonomyAnalysis(context) {
    console.log(
      `🔄 [Taxonomy Agent] Using fallback taxonomy analysis for: ${context.title}`,
    )

    const title = context.title.toLowerCase()
    const content = context.content.toLowerCase()
    const headings = context.headings.map(h => h.text.toLowerCase()).join(' ')

    // Infer primary topic from title and content
    let primaryTopic = 'documentation'
    let domainArea = 'general'
    let contentType = 'guide'

    // Domain detection
    if (
      title.includes('auth') ||
      content.includes('authentication') ||
      content.includes('login')
    ) {
      primaryTopic = 'authentication'
      domainArea = 'security'
    } else if (
      title.includes('config') ||
      content.includes('configuration') ||
      content.includes('setup')
    ) {
      primaryTopic = 'configuration'
      domainArea = 'infrastructure'
    } else if (
      title.includes('api') ||
      content.includes('endpoint') ||
      content.includes('rest')
    ) {
      primaryTopic = 'api'
      domainArea = 'development'
    } else if (
      title.includes('tutorial') ||
      title.includes('guide') ||
      headings.includes('step')
    ) {
      primaryTopic = 'tutorial'
      domainArea = 'development'
      contentType = 'tutorial'
    }

    // Difficulty assessment based on content complexity
    let difficulty = 'intermediate'
    if (context.wordCount < 200 || context.technicalTerms.length < 3) {
      difficulty = 'beginner'
    } else if (context.wordCount > 800 || context.technicalTerms.length > 8) {
      difficulty = 'advanced'
    }

    // Audience detection
    let audience = ['developers']
    if (
      content.includes('admin') ||
      content.includes('system') ||
      content.includes('server')
    ) {
      audience.push('system-administrators')
    }
    if (difficulty === 'beginner') {
      audience.push('beginners')
    }

    return {
      primaryTopic: primaryTopic,
      topics: [primaryTopic, domainArea],
      categories: [contentType, domainArea],
      subCategories: [],
      difficulty: difficulty,
      complexity:
        difficulty === 'beginner'
          ? 'low'
          : difficulty === 'advanced'
          ? 'high'
          : 'medium',
      audience: audience,
      targetRoles: audience.includes('system-administrators')
        ? ['devops-engineer']
        : ['developer'],
      prerequisites: difficulty === 'beginner' ? [] : ['basic-programming'],
      learningPath: [primaryTopic],
      contentType: contentType,
      domainArea: domainArea,
      conceptLevel: 'implementation',
      technicalDepth: 'detailed',
      industryTags: [],
      useCases: [primaryTopic + '-implementation'],
      relatedConcepts: context.technicalTerms.slice(0, 3),
      taxonomyScore: 70,
    }
  }

  /**
   * Identify what taxonomy improvements were made
   */
  identifyImprovements(original, enhanced) {
    const improvements = []

    if (!original.topics && enhanced.topics) {
      improvements.push('Added topic categorization')
    }

    if (!original.difficulty && enhanced.difficulty) {
      improvements.push('Added difficulty level')
    }

    if (!original.audience && enhanced.audience) {
      improvements.push('Added target audience')
    }

    if (!original.prerequisites && enhanced.prerequisites) {
      improvements.push('Added prerequisites')
    }

    if (!original.contentType && enhanced.contentType) {
      improvements.push('Added content type')
    }

    if (!original.domainArea && enhanced.domainArea) {
      improvements.push('Added domain classification')
    }

    if (enhanced.taxonomyScore) {
      improvements.push(`Taxonomy score: ${enhanced.taxonomyScore}/100`)
    }

    return improvements
  }
}

module.exports = TopicTaxonomyAgent
