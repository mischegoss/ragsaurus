class SEOMetadataGeneratorAgent {
  constructor() {
    this.name = 'seo-metadata-generator-agent'
    this.role = 'SEO Content Analysis Specialist'
    this.goal =
      'Generate comprehensive SEO-optimized metadata that improves discoverability and search rankings'
    this.backstory = `You are an expert SEO content analyst specializing in technical documentation optimization. 
                  You excel at understanding technical content, extracting meaningful keywords, creating compelling 
                  descriptions, and generating metadata that improves both search engine rankings and user discovery.
                  You use advanced AI analysis to create SEO metadata that balances technical accuracy with 
                  search optimization principles.`
    this.verbose = true
    this.allowDelegation = false
    this.maxIter = 3
    this.memory = true
  }

  /**
   * Analyze document content and generate enhanced SEO metadata
   */
  async analyzeContent(filePath, content, currentMetadata = {}) {
    console.log(`🔍 [SEO Agent] Analyzing: ${filePath}`)

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
        links: this.extractLinks(parsed.content),
      }

      // Generate enhanced SEO metadata using Gemini
      const enhancedMetadata = await this.generateSEOMetadata(analysisContext)

      console.log(`✅ [SEO Agent] Enhanced SEO metadata for: ${filePath}`)

      return {
        originalMetadata: parsed.data,
        enhancedMetadata,
        content: parsed.content,
        improvements: this.identifyImprovements(parsed.data, enhancedMetadata),
      }
    } catch (error) {
      console.error(
        `❌ [SEO Agent] Error analyzing ${filePath}:`,
        error.message,
      )
      throw error
    }
  }

  /**
   * Extract headings from markdown content with hierarchy analysis
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
   * Extract code blocks to understand technical content
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
   * Extract links to understand content relationships
   */
  extractLinks(content) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    const links = []
    let match

    while ((match = linkRegex.exec(content)) !== null) {
      links.push({
        text: match[1],
        url: match[2],
      })
    }

    return links
  }

  /**
   * Generate comprehensive SEO metadata using Gemini AI
   */
  async generateSEOMetadata(context) {
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
        '❌ [SEO Agent] GOOGLE_API_KEY not found in environment variables',
      )
      throw new Error('GOOGLE_API_KEY not found in environment variables')
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = this.buildSEOAnalysisPrompt(context)

    try {
      console.log(
        `🤖 [SEO Agent] Calling Gemini for comprehensive SEO analysis...`,
      )
      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      // Clean the response - remove markdown code blocks if present
      let cleanedText = text.trim()
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '')
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      // Parse the JSON response from Gemini
      const seoMetadata = JSON.parse(cleanedText)

      // Validate and clean the metadata
      const validatedMetadata = this.validateAndCleanSEOMetadata(seoMetadata)

      console.log(`🎯 [SEO Agent] SEO analysis complete`)
      return validatedMetadata
    } catch (error) {
      console.error('❌ [SEO Agent] Gemini API error:', error.message)
      // Fallback to basic SEO analysis if Gemini fails
      return this.fallbackSEOAnalysis(context)
    }
  }

  /**
   * Build the comprehensive SEO analysis prompt for Gemini
   */
  buildSEOAnalysisPrompt(context) {
    return `You are an expert SEO analyst specializing in technical documentation. Analyze this document and generate comprehensive SEO metadata that will improve search rankings, discoverability, and user engagement.

DOCUMENT TO ANALYZE:
Title: ${context.title}
Word Count: ${context.wordCount}
Headings: ${context.headings
      .map(h => `${'#'.repeat(h.level)} ${h.text}`)
      .join('\n')}
${
  context.codeBlocks.length > 0
    ? `Code Languages: ${[
        ...new Set(context.codeBlocks.map(b => b.language)),
      ].join(', ')}`
    : ''
}
${context.links.length > 0 ? `External Links: ${context.links.length}` : ''}

CONTENT:
${context.content.substring(0, 2500)}${
      context.content.length > 2500 ? '...' : ''
    }

CURRENT METADATA:
${JSON.stringify(context.currentMetadata, null, 2)}

Generate comprehensive SEO metadata as valid JSON with these fields:

{
  "title": "SEO-optimized title (50-60 chars, keyword-rich)",
  "description": "Compelling meta description (150-160 chars, action-oriented)",
  "keywords": ["primary-keyword", "secondary-keyword", "long-tail-keyword", "semantic-keyword", "technical-term"],
  "searchKeywords": ["search-term-1", "search-term-2", "user-query-keyword"],
  "semanticTerms": ["related-concept-1", "related-concept-2", "industry-term"],
  "focusKeyword": "primary-target-keyword",
  "keywordDensity": "balanced|high|low",
  "contentType": "tutorial|reference|guide|overview|troubleshooting",
  "searchIntent": "informational|navigational|transactional|commercial",
  "readingLevel": "beginner|intermediate|advanced",
  "estimatedReadingTime": 5,
  "lastUpdated": "${new Date().toISOString().split('T')[0]}",
  "author": "Technical Documentation Team",
  "category": "primary-category",
  "tags": ["tag1", "tag2", "tag3"],
  "audience": ["developers", "system-administrators", "beginners"],
  "seoScore": 85
}

CRITICAL SEO REQUIREMENTS:
- Title must be 50-60 characters and keyword-rich
- Description must be 150-160 characters and compelling
- Focus on search terms real users would type
- Include semantic keywords and related terms
- Ensure keywords flow naturally
- Consider search intent and user goals
- Make content type and audience clear

Return ONLY valid JSON, no markdown formatting, no code blocks.`
  }

  /**
   * Validate and clean SEO metadata to ensure quality
   */
  validateAndCleanSEOMetadata(metadata) {
    const cleaned = { ...metadata }

    // Validate title length (50-60 chars optimal for SEO)
    if (cleaned.title && cleaned.title.length > 60) {
      cleaned.title = cleaned.title.substring(0, 57) + '...'
    }

    // Validate description length (150-160 chars optimal for SEO)
    if (cleaned.description && cleaned.description.length > 160) {
      cleaned.description = cleaned.description.substring(0, 157) + '...'
    }

    // Ensure arrays are clean and have reasonable limits
    const arrayFields = [
      'keywords',
      'searchKeywords',
      'semanticTerms',
      'tags',
      'audience',
    ]
    arrayFields.forEach(field => {
      if (cleaned[field] && Array.isArray(cleaned[field])) {
        cleaned[field] = cleaned[field]
          .filter(item => item && typeof item === 'string' && item.trim())
          .map(item => item.trim().toLowerCase().replace(/"/g, "'"))
          .slice(0, 8) // Limit to 8 items max
      }
    })

    // Ensure required fields have defaults
    if (!cleaned.keywords || cleaned.keywords.length === 0) {
      cleaned.keywords = ['documentation', 'guide']
    }

    if (!cleaned.tags || cleaned.tags.length === 0) {
      cleaned.tags = ['documentation']
    }

    // Validate numeric fields
    if (!cleaned.seoScore || isNaN(cleaned.seoScore)) {
      cleaned.seoScore = 75 // Default score
    }

    if (!cleaned.estimatedReadingTime || isNaN(cleaned.estimatedReadingTime)) {
      cleaned.estimatedReadingTime = Math.max(
        1,
        Math.ceil(metadata.wordCount / 200) || 3,
      )
    }

    return cleaned
  }

  /**
   * Fallback SEO analysis if Gemini fails
   */
  fallbackSEOAnalysis(context) {
    console.log(
      `🔄 [SEO Agent] Using fallback SEO analysis for: ${context.title}`,
    )

    // Extract keywords from content
    const words = context.content.toLowerCase().split(/\s+/)
    const commonWords = [
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
    ]

    const keywordCandidates = words
      .filter(word => word.length > 3 && !commonWords.includes(word))
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1
        return acc
      }, {})

    const topKeywords = Object.entries(keywordCandidates)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word)

    // Generate basic SEO metadata
    return {
      title:
        context.title.length > 60
          ? context.title.substring(0, 57) + '...'
          : context.title,
      description: `Learn about ${context.title.toLowerCase()}. This comprehensive guide covers key concepts and practical implementation.`,
      keywords:
        topKeywords.length > 0 ? topKeywords : ['documentation', 'guide'],
      searchKeywords: topKeywords.slice(0, 3),
      semanticTerms: [],
      focusKeyword: topKeywords[0] || 'documentation',
      keywordDensity: 'balanced',
      contentType: this.inferContentType(context),
      searchIntent: 'informational',
      readingLevel:
        context.wordCount < 500
          ? 'beginner'
          : context.wordCount < 1000
          ? 'intermediate'
          : 'advanced',
      estimatedReadingTime: Math.max(1, Math.ceil(context.wordCount / 200)),
      lastUpdated: new Date().toISOString().split('T')[0],
      author: 'Technical Documentation Team',
      category: 'documentation',
      tags: topKeywords.slice(0, 3).concat(['documentation']),
      audience: ['developers'],
      seoScore: 70,
    }
  }

  /**
   * Infer content type from structure and headings
   */
  inferContentType(context) {
    const title = context.title.toLowerCase()
    const headings = context.headings.map(h => h.text.toLowerCase()).join(' ')

    if (
      title.includes('tutorial') ||
      headings.includes('step') ||
      headings.includes('how to')
    ) {
      return 'tutorial'
    } else if (
      title.includes('reference') ||
      title.includes('api') ||
      headings.includes('parameters')
    ) {
      return 'reference'
    } else if (
      title.includes('troubleshoot') ||
      headings.includes('error') ||
      headings.includes('problem')
    ) {
      return 'troubleshooting'
    } else if (title.includes('overview') || title.includes('introduction')) {
      return 'overview'
    } else {
      return 'guide'
    }
  }

  /**
   * Identify what SEO improvements were made
   */
  identifyImprovements(original, enhanced) {
    const improvements = []

    if (!original.description && enhanced.description) {
      improvements.push('Added SEO-optimized description')
    }

    if (!original.keywords && enhanced.keywords) {
      improvements.push('Added target keywords')
    }

    if (!original.focusKeyword && enhanced.focusKeyword) {
      improvements.push('Added focus keyword')
    }

    if (!original.searchKeywords && enhanced.searchKeywords) {
      improvements.push('Added search keywords')
    }

    if (!original.contentType && enhanced.contentType) {
      improvements.push('Added content type classification')
    }

    if (!original.searchIntent && enhanced.searchIntent) {
      improvements.push('Added search intent analysis')
    }

    if (enhanced.seoScore) {
      improvements.push(`SEO score: ${enhanced.seoScore}/100`)
    }

    return improvements
  }
}

module.exports = SEOMetadataGeneratorAgent
