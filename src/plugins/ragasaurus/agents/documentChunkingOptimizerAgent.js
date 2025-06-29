class DocumentChunkingOptimizerAgent {
  constructor() {
    this.name = 'document-chunking-optimizer-agent'
    this.role = 'Document Structure Enhancement Specialist'
    this.goal =
      'Actively restructure documents for optimal chunking and RAG retrieval effectiveness'
    this.backstory = `You are an expert document restructuring specialist who doesn't just analyze - you actually improve content organization. 
                              You excel at breaking up wall-of-text sections, adding missing headings, creating semantic bridges between concepts,
                              and rewriting content for both human readability and AI comprehension. You work like a professional editor.`
    this.verbose = true
    this.allowDelegation = false
    this.maxIter = 3
    this.memory = true
  }

  /**
   * Main entry point - analyze and RESTRUCTURE document content
   */
  async analyzeContent(filePath, content, currentMetadata = {}) {
    console.log(`✂️ [Chunking Agent] Analyzing: ${filePath}`)

    try {
      // Parse the document to separate content from frontmatter
      const matter = require('gray-matter')
      const parsed = matter(content)

      // Analyze current structure
      const analysisContext = {
        title: parsed.data.title || 'Untitled',
        content: parsed.content,
        currentMetadata: parsed.data,
        wordCount: parsed.content.split(/\s+/).length,
        headings: this.extractHeadingStructure(parsed.content),
        sections: this.analyzeSectionLengths(parsed.content),
        codeBlocks: this.extractCodeBlocks(parsed.content),
        structuralIssues: this.identifyStructuralIssues(parsed.content),
      }

      console.log(
        `🤖 [Chunking Agent] Calling Gemini for content restructuring...`,
      )

      // Generate restructuring plan
      const restructuringPlan = await this.generateRestructuringPlan(
        analysisContext,
      )

      // Actually restructure the content
      const restructuredContent = await this.applyRestructuring(
        parsed.content,
        restructuringPlan,
      )

      // Update frontmatter with chunking metadata
      const enhancedMetadata = this.generateChunkingMetadata(
        analysisContext,
        restructuringPlan,
      )

      // Create final document with enhanced frontmatter and restructured content
      const finalContent = matter.stringify(restructuredContent, {
        ...parsed.data,
        ...enhancedMetadata,
      })

      // Write the improved content back to the file
      await this.writeImprovedContent(filePath, finalContent)

      console.log(
        `🎯 [Chunking Agent] Document structure enhanced and rewritten: ${filePath}`,
      )

      return {
        originalMetadata: parsed.data,
        enhancedMetadata,
        originalContent: parsed.content,
        restructuredContent,
        improvements: this.calculateImprovements(
          analysisContext,
          restructuringPlan,
        ),
        structureScoreImprovement: restructuringPlan.scoreImprovement || 0,
      }
    } catch (error) {
      console.error(
        `❌ [Chunking Agent] Error restructuring ${filePath}:`,
        error.message,
      )
      // Fallback to original analysis-only behavior
      return this.fallbackAnalysis(content)
    }
  }

  /**
   * Identify structural issues that need fixing
   */
  identifyStructuralIssues(content) {
    const issues = []
    const lines = content.split('\n')

    // Find oversized sections (sections with >500 words between headings)
    const sections = this.analyzeSectionLengths(content)
    sections.forEach((section, index) => {
      if (section.wordCount > 500) {
        issues.push({
          type: 'oversized_section',
          heading: section.heading,
          wordCount: section.wordCount,
          startLine: section.startLine,
          severity: section.wordCount > 700 ? 'high' : 'medium',
        })
      }
    })

    // Find missing heading hierarchy (large gaps in heading levels)
    const headings = this.extractHeadingStructure(content)
    for (let i = 0; i < headings.length - 1; i++) {
      const currentLevel = headings[i].level
      const nextLevel = headings[i + 1].level
      if (nextLevel - currentLevel > 1) {
        issues.push({
          type: 'heading_hierarchy_gap',
          from: currentLevel,
          to: nextLevel,
          line: headings[i + 1].line,
        })
      }
    }

    // Find code blocks without proper context
    const codeBlocks = this.extractCodeBlocks(content)
    codeBlocks.forEach(block => {
      if (!block.hasContext) {
        issues.push({
          type: 'orphaned_code_block',
          language: block.language,
          line: block.line,
        })
      }
    })

    return issues
  }

  /**
   * Generate restructuring plan using Gemini
   */
  async generateRestructuringPlan(context) {
    try {
      const geminiPrompt = this.buildRestructuringPrompt(context)
      const response = await this.callGemini(geminiPrompt)
      return this.parseRestructuringResponse(response)
    } catch (error) {
      console.warn(
        `⚠️ [Chunking Agent] Gemini restructuring failed: ${error.message}`,
      )
      return this.generateFallbackPlan(context)
    }
  }

  /**
   * Build comprehensive prompt for content restructuring
   */
  buildRestructuringPrompt(context) {
    return `You are a professional technical documentation editor. Restructure this document for optimal readability and AI retrieval.
  
  IMPORTANT: Respond with ONLY valid JSON, no markdown formatting, no backticks, no explanations.
      
  DOCUMENT ANALYSIS:
  Title: "${context.title}"
  Word Count: ${context.wordCount}
  Current Headings: ${context.headings.length}
  Structural Issues: ${context.structuralIssues.length}
      
  CONTENT:
  ${context.content}
      
  RESTRUCTURING TASKS:
  1. Add missing H2/H3 headings to break up sections >400 words
  2. Split oversized sections into logical subsections
  3. Add semantic bridges between major sections
  4. Improve heading hierarchy and consistency
  5. Add contextual anchors around code blocks
  6. Ensure each section has a clear, focused purpose
      
  REQUIREMENTS:
  - Preserve all original information and technical accuracy
  - Maintain the author's voice and style
  - Add headings, don't move content around extensively
  - Focus on organization improvements, not content rewrites
  - Ensure each section is 200-400 words for optimal chunking
  
  Respond with valid JSON only:
  {
    "actions": [
      {
        "type": "add_heading",
        "level": 2,
        "text": "New Heading Text",
        "insertAfter": "existing content to find",
        "reason": "explanation"
      }
    ],
    "scoreImprovement": 15,
    "summary": "Brief description of improvements"
  }`
  }

  /**
   * Apply restructuring actions to content
   */
  async applyRestructuring(originalContent, plan) {
    let content = originalContent

    // Sort actions by line position (reverse order to maintain positions)
    const sortedActions = [...plan.actions].sort((a, b) => {
      const posA = this.findContentPosition(
        content,
        a.insertAfter || a.originalHeading || '',
      )
      const posB = this.findContentPosition(
        content,
        b.insertAfter || b.originalHeading || '',
      )
      return posB - posA
    })

    // Apply each restructuring action
    for (const action of sortedActions) {
      switch (action.type) {
        case 'add_heading':
          content = this.addHeading(content, action)
          break
        case 'split_section':
          content = this.splitSection(content, action)
          break
        case 'add_bridge':
          content = this.addSemanticBridge(content, action)
          break
        case 'add_context':
          content = this.addCodeContext(content, action)
          break
      }
    }

    return content
  }

  /**
   * Add a new heading at specified location
   */
  addHeading(content, action) {
    const insertPoint = this.findContentPosition(content, action.insertAfter)
    if (insertPoint === -1) return content

    const lines = content.split('\n')
    const headingPrefix = '#'.repeat(action.level)
    const newHeading = `\n${headingPrefix} ${action.text}\n`

    lines.splice(insertPoint + 1, 0, newHeading)

    console.log(
      `   ✅ Added ${action.level === 2 ? 'H2' : 'H3'} heading: "${
        action.text
      }"`,
    )
    return lines.join('\n')
  }

  /**
   * Split an oversized section into subsections
   */
  splitSection(content, action) {
    const sectionStart = content.indexOf(action.originalHeading)
    if (sectionStart === -1) return content

    let result = content
    action.newSubsections.forEach((subsection, index) => {
      if (action.splitPoints[index]) {
        const splitPoint = this.findContentPosition(
          result,
          action.splitPoints[index],
        )
        if (splitPoint !== -1) {
          result = this.addHeading(result, {
            level: 3,
            text: subsection,
            insertAfter: action.splitPoints[index],
          })
        }
      }
    })

    console.log(
      `   ✂️ Split section "${action.originalHeading}" into ${action.newSubsections.length} subsections`,
    )
    return result
  }

  /**
   * Add semantic bridge between sections
   */
  addSemanticBridge(content, action) {
    const insertPoint = this.findContentPosition(content, action.insertAfter)
    if (insertPoint === -1) return content

    const lines = content.split('\n')
    lines.splice(insertPoint + 1, 0, '', action.bridgeText, '')

    console.log(`   🌉 Added semantic bridge`)
    return lines.join('\n')
  }

  /**
   * Write improved content back to file (NO BACKUP CREATION)
   */
  async writeImprovedContent(filePath, content) {
    const fs = require('fs').promises

    try {
      // Write improved content directly (no backup)
      await fs.writeFile(filePath, content, 'utf8')

      console.log(`   💾 Content restructured and saved to ${filePath}`)
    } catch (error) {
      console.error(`   ❌ Failed to write improved content: ${error.message}`)
      throw error
    }
  }

  /**
   * Calculate improvements made
   */
  calculateImprovements(originalContext, plan) {
    const improvements = []

    plan.actions.forEach(action => {
      switch (action.type) {
        case 'add_heading':
          improvements.push(
            `Added ${action.level === 2 ? 'H2' : 'H3'} heading: "${
              action.text
            }"`,
          )
          break
        case 'split_section':
          improvements.push(
            `Split "${action.originalHeading}" into ${action.newSubsections.length} subsections`,
          )
          break
        case 'add_bridge':
          improvements.push('Added semantic bridge between sections')
          break
      }
    })

    if (plan.scoreImprovement) {
      improvements.push(
        `Structure score improved by ${plan.scoreImprovement} points`,
      )
    }

    return improvements
  }

  /**
   * Generate chunking metadata for frontmatter
   */
  generateChunkingMetadata(context, plan) {
    return {
      chunkingEnhanced: true,
      chunkingDate: new Date().toISOString(),
      structureImprovements: plan.actions.length,
      optimalChunkSize: 350, // Target chunk size after restructuring
      chunkingScore: Math.min(90, 70 + (plan.scoreImprovement || 0)),
      headingsAdded: plan.actions.filter(a => a.type === 'add_heading').length,
      sectionsRestructured: plan.actions.filter(a => a.type === 'split_section')
        .length,
      semanticBridges: plan.actions.filter(a => a.type === 'add_bridge').length,
      enhanced_by: 'rag-prep-plugin-chunking-restructurer',
      enhanced_at: new Date().toISOString(),
    }
  }

  /**
   * Utility functions
   */
  findContentPosition(content, searchText) {
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i
      }
    }
    return -1
  }

  extractHeadingStructure(content) {
    const headingMatches = content.match(/^#+\s+(.+)$/gm) || []
    return headingMatches.map((heading, index) => ({
      level: (heading.match(/^#+/) || [''])[0].length,
      text: heading.replace(/^#+\s+/, '').trim(),
      line: index,
    }))
  }

  analyzeSectionLengths(content) {
    const lines = content.split('\n')
    const sections = []
    let currentSection = { heading: 'Introduction', startLine: 0, content: [] }

    lines.forEach((line, index) => {
      if (line.match(/^#+\s+/)) {
        // End current section
        if (currentSection.content.length > 0) {
          currentSection.wordCount = currentSection.content
            .join(' ')
            .split(/\s+/).length
          sections.push(currentSection)
        }
        // Start new section
        currentSection = {
          heading: line.replace(/^#+\s+/, ''),
          startLine: index,
          content: [],
        }
      } else {
        currentSection.content.push(line)
      }
    })

    // Add final section
    if (currentSection.content.length > 0) {
      currentSection.wordCount = currentSection.content
        .join(' ')
        .split(/\s+/).length
      sections.push(currentSection)
    }

    return sections
  }

  extractCodeBlocks(content) {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
    const blocks = []
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2],
        hasContext: this.checkCodeContext(content, match.index),
      })
    }

    return blocks
  }

  checkCodeContext(content, codePosition) {
    const beforeCode = content.substring(
      Math.max(0, codePosition - 200),
      codePosition,
    )
    const afterCode = content.substring(codePosition + 100, codePosition + 300)

    // Check if there's explanatory text near the code block
    const hasExplanation =
      beforeCode.match(/example|following|shows|demonstrates/i) ||
      afterCode.match(/above|previous|this code|example/i)

    return !!hasExplanation
  }

  /**
   * Fixed JSON parsing with better error handling
   */
  parseRestructuringResponse(response) {
    try {
      // Clean the response - remove markdown code blocks and extra whitespace
      let cleanedResponse = response.trim()

      // Remove markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse
          .replace(/^```json\s*/, '')
          .replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse
          .replace(/^```\s*/, '')
          .replace(/\s*```$/, '')
      }

      // Remove any leading/trailing text that isn't JSON
      const jsonStart = cleanedResponse.indexOf('{')
      const jsonEnd = cleanedResponse.lastIndexOf('}')

      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd + 1)
      }

      const parsed = JSON.parse(cleanedResponse)

      // Validate the response structure
      if (!parsed.actions || !Array.isArray(parsed.actions)) {
        console.warn('⚠️ Invalid response structure, using fallback')
        throw new Error('Invalid response structure')
      }

      return parsed
    } catch (error) {
      console.warn(`⚠️ Failed to parse Gemini response: ${error.message}`)
      console.warn(`Response preview: ${response.substring(0, 200)}...`)
      return {
        actions: [],
        scoreImprovement: 0,
        summary: 'Fallback restructuring - JSON parsing failed',
      }
    }
  }

  generateFallbackPlan(context) {
    const actions = []

    // Add basic heading improvements for oversized sections
    context.structuralIssues.forEach(issue => {
      if (issue.type === 'oversized_section' && issue.severity === 'high') {
        actions.push({
          type: 'add_heading',
          level: 3,
          text: `${issue.heading} Details`,
          insertAfter: issue.heading,
          reason: 'Break up oversized section',
        })
      }
    })

    return {
      actions,
      scoreImprovement: actions.length * 5,
      summary: `Fallback restructuring: ${actions.length} improvements`,
    }
  }

  // Google API call (exactly matching your existing agents' pattern)
  async callGemini(prompt) {
    // Load environment variables (same pattern as Tavily agent)
    if (!process.env.GEMINI_API_KEY) {
      try {
        const path = require('path')
        const envPath = path.join(process.cwd(), '.env.local')
        console.log('🔍 [Chunking Agent] Loading env from:', envPath)
        require('dotenv').config({
          path: envPath,
        })
        console.log(
          '🔍 [Chunking Agent] After loading, GOOGLE_API_KEY exists:',
          !!process.env.GOOGLE_API_KEY,
        )
      } catch (error) {
        console.warn(
          '⚠️ [Chunking Agent] Could not load .env.local file:',
          error.message,
        )
      }
    }

    // Also try common alternative names
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY

    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai')

      if (!geminiKey) {
        console.error('❌ [Chunking Agent] No Gemini API key found. Checked:')
        console.error('   - GEMINI_API_KEY:', !!process.env.GEMINI_API_KEY)
        console.error('   - GOOGLE_API_KEY:', !!process.env.GOOGLE_API_KEY)
        console.error(
          '   - GOOGLE_GEMINI_API_KEY:',
          !!process.env.GOOGLE_GEMINI_API_KEY,
        )
        console.error(
          '   - GOOGLE_GENERATIVE_AI_API_KEY:',
          !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        )
        console.error(
          '❌ [Chunking Agent] All env vars starting with GEMINI or GOOGLE:',
          Object.keys(process.env).filter(
            k => k.includes('GEMINI') || k.includes('GOOGLE'),
          ),
        )
        throw new Error('No Gemini API key found in environment variables')
      }

      console.log('🔑 [Chunking Agent] Found Gemini API key, calling Gemini...')

      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.error('❌ [Chunking Agent] Gemini API error:', error.message)
      throw error
    }
  }

  fallbackAnalysis(content) {
    // Return analysis-only result if restructuring fails
    return {
      originalMetadata: {},
      enhancedMetadata: {
        chunkingEnhanced: false,
        chunkingScore: 60,
        enhanced_by: 'rag-prep-plugin-chunking-fallback',
      },
      improvements: ['Analysis completed (restructuring failed)'],
    }
  }
}

module.exports = DocumentChunkingOptimizerAgent
