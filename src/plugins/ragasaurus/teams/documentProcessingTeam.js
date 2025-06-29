/**
 * Document Processing Team (Multi-Agent Version)
 * Orchestrates up to 6 AI agents for comprehensive document enhancement
 * Supports dynamic agent loading and collaborative processing
 */
class DocumentProcessingTeam {
  constructor() {
    this.name = 'DocumentProcessingTeam'
    this.description =
      'AI-powered team that enhances documentation using multiple specialized agents'
    this.agents = []
    this.tasks = []
    this.verbose = true
    this.memory = true
    this.maxAgents = 6
  }

  /**
   * Add an agent to the team
   */
  addAgent(agent) {
    if (this.agents.length >= this.maxAgents) {
      console.warn(
        `⚠️ [Document Team] Maximum agent limit (${this.maxAgents}) reached. Skipping ${agent.name}`,
      )
      return false
    }

    this.agents.push(agent)
    console.log(
      `👥 [Document Team] Added agent ${this.agents.length}/${this.maxAgents}: ${agent.name} (${agent.role})`,
    )
    return true
  }

  /**
   * Add a task to the team
   */
  addTask(task) {
    this.tasks.push(task)
    console.log(`📋 [Document Team] Added task: ${task.constructor.name}`)
  }

  /**
   * Initialize the team with all available agents and tasks
   */
  async initialize() {
    console.log(
      '🚀 [Document Team] Initializing multi-agent document processing team...',
    )

    try {
      // Clear existing agents/tasks
      this.agents = []
      this.tasks = []

      // Load all available agents
      const agents = await this.loadAllAgents()

      // Add agents to team
      agents.forEach(agent => this.addAgent(agent))

      // Create and configure the multi-agent task
      const EnhanceMetadataTask = require('../tasks/enhanceMetadataTask')
      const enhanceTask = new EnhanceMetadataTask()

      // Assign ALL agents to the task
      enhanceTask.agents = [...this.agents] // Pass all agents to the task

      // Add task to team
      this.addTask(enhanceTask)

      console.log('✅ [Document Team] Multi-agent team initialized:')
      console.log(`   - ${this.agents.length} Active Agents:`)
      this.agents.forEach((agent, index) => {
        console.log(`     ${index + 1}. ${agent.name} (${agent.role})`)
      })
      console.log(`   - 1 Multi-Agent Task: Enhanced Metadata Processing`)

      return true
    } catch (error) {
      console.error('❌ [Document Team] Initialization error:', error.message)
      throw error
    }
  }

  /**
   * Load all available agents dynamically
   */
  async loadAllAgents() {
    const agents = []

    // Agent configurations - all three agents now enabled
    const agentConfigs = [
      {
        name: 'SEO Metadata Generator',
        module: '../agents/keywordExtractionAgent',
        required: false,
        description: 'Generates SEO-optimized keywords and descriptions',
      },
      {
        name: 'Topic Taxonomy Agent',
        module: '../agents/topicTaxonomyAgent',
        required: false,
        description: 'Creates hierarchical topic classifications',
      },
      {
        name: 'Document Chunking Optimizer',
        module: '../agents/documentChunkingOptimizerAgent',
        required: false,
        description:
          'Optimizes document structure and chunking for RAG effectiveness',
      },
      {
        name: 'Content Research Agent',
        module: '../agents/contentResearchAgent',
        required: false,
        description:
          'Conducts real-time web research using Tavily to validate content and find industry best practices',
      },
    ]

    // Load each agent
    for (const config of agentConfigs) {
      try {
        console.log(`🔄 [Document Team] Loading ${config.name}...`)

        const AgentClass = require(config.module)
        const agent = new AgentClass()

        agents.push(agent)
        console.log(`   ✅ Loaded: ${agent.name}`)
      } catch (error) {
        const errorMsg = `Failed to load ${config.name}: ${error.message}`

        if (config.required) {
          console.error(`   ❌ ${errorMsg}`)
          throw new Error(`Required agent failed to load: ${config.name}`)
        } else {
          console.warn(`   ⚠️ ${errorMsg} (optional agent, continuing...)`)
        }
      }
    }

    // If no agents loaded, create a mock agent to prevent errors
    if (agents.length === 0) {
      console.log('⚠️ [Document Team] No agents loaded, creating mock agent...')
      agents.push({
        name: 'mock-agent',
        role: 'Mock Enhancement Agent',
        goal: 'Provide basic enhancement until real agents are available',
        analyzeContent: async (filePath, content) => {
          return {
            enhancedMetadata: { ragScore: 70 },
            improvements: ['Basic mock enhancement'],
          }
        },
      })
    }

    console.log(
      `📊 [Document Team] Successfully loaded ${agents.length}/${agentConfigs.length} agents`,
    )
    return agents
  }

  /**
   * Process documents through the multi-agent workflow
   */
  async processDocuments(processedFiles) {
    console.log(
      '\n🎯 [Document Team] Starting multi-agent document processing workflow...',
    )

    try {
      // Filter files that need enhancement
      const filesToEnhance = processedFiles.filter(
        file => file.needsEnhancement,
      )
      const skippedFiles = processedFiles.filter(file => !file.needsEnhancement)

      if (filesToEnhance.length === 0) {
        console.log('ℹ️ [Document Team] No enhancement needed.')
        return {
          success: true,
          summary: {
            totalFiles: processedFiles.length,
            successful: 0,
            skipped: skippedFiles.length,
            errors: 0,
            averageRagScore: 0,
            agentCount: this.agents.length,
            message: 'All files already enhanced within 24 hours',
          },
          enhancements: [],
          errors: [],
        }
      }

      // Initialize team if not already done
      if (!this.agents.length || !this.tasks.length) {
        await this.initialize()
      }

      // Prepare context for multi-agent processing
      const context = {
        processedFiles: filesToEnhance,
        timestamp: new Date().toISOString(),
        teamName: this.name,
        agentCount: this.agents.length,
        estimatedOperations: filesToEnhance.length * this.agents.length,
      }

      console.log(
        `\n🤖 [Document Team] Processing ${filesToEnhance.length} files through ${this.agents.length} agents...`,
      )
      console.log(
        `   📊 Estimated total operations: ${context.estimatedOperations}`,
      )

      // Execute the multi-agent enhancement task
      const enhanceTask = this.tasks[0]
      const result = await enhanceTask.execute(context)

      if (result.success) {
        // Add skipped files info to the result
        result.summary.skipped = skippedFiles.length
        result.summary.totalFiles = processedFiles.length
        result.summary.agentCount = this.agents.length

        console.log(
          '✅ [Document Team] Multi-agent workflow completed successfully!',
        )
        this.logMultiAgentResults(result, skippedFiles.length)
      } else {
        console.error(
          '❌ [Document Team] Multi-agent workflow failed:',
          result.error,
        )
      }

      return result
    } catch (error) {
      console.error(
        '❌ [Document Team] Fatal multi-agent workflow error:',
        error.message,
      )
      console.error('❌ [Document Team] Stack trace:', error.stack)
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Log detailed multi-agent workflow results
   */
  logMultiAgentResults(result, skippedCount = 0) {
    const { summary, agentStatistics } = result

    console.log('\n📊 MULTI-AGENT WORKFLOW RESULTS:')
    console.log('==================================')
    console.log(`📁 Total files found: ${summary.totalFiles}`)
    console.log(`✅ Successfully enhanced: ${summary.successful}`)
    console.log(`⏭️ Skipped (recently enhanced): ${skippedCount}`)
    console.log(`❌ Errors encountered: ${summary.errors}`)
    console.log(`🤖 Active agents: ${summary.agentCount || this.agents.length}`)
    console.log(`🎯 Average RAG score: ${summary.averageRagScore}/100`)

    if (summary.agentCollaborations) {
      console.log(`🤝 Agent collaborations: ${summary.agentCollaborations}`)
      console.log(
        `📈 Collaboration effectiveness: ${summary.collaborationEffectiveness}%`,
      )
    }

    // Show agent performance statistics
    if (agentStatistics) {
      console.log('\n🏆 AGENT PERFORMANCE:')
      Object.entries(agentStatistics).forEach(([agentName, stats]) => {
        const total = stats.successful + stats.failed
        const successRate =
          total > 0 ? Math.round((stats.successful / total) * 100) : 0
        console.log(
          `   ${agentName}: ${stats.successful}/${total} files (${successRate}% success)`,
        )
      })
    }

    // Show GitHub PR information if created
    if (summary.githubPR) {
      console.log('\n🔗 GITHUB PULL REQUEST:')
      console.log(
        `   📝 PR #${summary.githubPR.number}: ${summary.githubPR.url}`,
      )
      console.log(`   🌲 Branch: ${summary.githubPR.branch}`)
      console.log(`   📋 Status: ${summary.githubPR.status}`)
      console.log(
        `   🤖 Agent Collaboration: ${
          summary.githubPR.agentCollaboration ? 'Yes' : 'No'
        }`,
      )
    }

    console.log('\n🎉 Multi-agent document enhancement workflow complete!')
    console.log(
      `🔍 Processed ${summary.successful} files with ${this.agents.length} AI agents`,
    )
  }

  /**
   * Get team status and statistics
   */
  getTeamStatus() {
    return {
      name: this.name,
      agentCount: this.agents.length,
      maxAgents: this.maxAgents,
      taskCount: this.tasks.length,
      agents: this.agents.map(agent => ({
        name: agent.name,
        role: agent.role,
        goal: agent.goal,
      })),
      initialized: this.agents.length > 0 && this.tasks.length > 0,
      capacity: `${this.agents.length}/${this.maxAgents} agents`,
    }
  }

  /**
   * Add multiple agents at once
   */
  addAgents(agents) {
    const added = []
    agents.forEach(agent => {
      if (this.addAgent(agent)) {
        added.push(agent.name)
      }
    })
    return added
  }

  /**
   * Remove an agent by name
   */
  removeAgent(agentName) {
    const index = this.agents.findIndex(agent => agent.name === agentName)
    if (index > -1) {
      const removed = this.agents.splice(index, 1)[0]
      console.log(`🗑️ [Document Team] Removed agent: ${removed.name}`)
      return true
    }
    return false
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return {
      teamName: this.name,
      agentsCount: this.agents.length,
      maxAgents: this.maxAgents,
      tasksCount: this.tasks.length,
      initialized: this.agents.length > 0 && this.tasks.length > 0,
      lastRun: this.lastRunTimestamp || null,
      estimatedCapacity: this.maxAgents * 100, // files per hour estimate
    }
  }

  /**
   * Reset team state (useful for testing)
   */
  reset() {
    this.agents = []
    this.tasks = []
    this.lastRunTimestamp = null
    console.log('🔄 [Document Team] Team reset - all agents and tasks cleared')
  }
}

// CRITICAL: Ensure proper module export
module.exports = DocumentProcessingTeam
