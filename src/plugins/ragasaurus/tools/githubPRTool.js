const { Octokit } = require('@octokit/rest')
const path = require('path')

class GitHubPRTool {
  constructor() {
    this.name = 'github-pr-tool'
    this.description =
      'Creates pull requests for RAG documentation enhancements without modifying local files'

    // Initialize Octokit with token from environment
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    })

    // Get repo info from package.json or environment
    this.owner = process.env.GITHUB_OWNER || 'yourusername' // Replace with your GitHub username
    this.repo = process.env.GITHUB_REPO || 'rag-plugin-demo-site' // Replace with your repo name
  }

  /**
   * Create a PR with proposed enhanced documentation files (staging only)
   */
  async createEnhancementPR(proposedEnhancements, summary) {
    console.log(
      '🔀 [GitHub PR] Creating enhancement pull request with proposed changes...',
    )

    try {
      // 1. Get the default branch (usually 'main' or 'master')
      const { data: repoData } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      })
      const defaultBranch = repoData.default_branch

      // 2. Get the latest commit SHA from default branch
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${defaultBranch}`,
      })
      const latestCommitSha = refData.object.sha

      // 3. Create a new branch for our proposed enhancements
      const branchName = `rag-enhancements-${Date.now()}`
      await this.octokit.rest.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: latestCommitSha,
      })

      console.log(`📝 [GitHub PR] Created branch: ${branchName}`)

      // 4. Commit proposed enhanced files to branch (from memory, not disk)
      for (const enhancement of proposedEnhancements) {
        if (enhancement.enhancedContent) {
          await this.commitProposedEnhancement(branchName, enhancement)
        }
      }

      // 5. Create the pull request
      const prTitle = `🤖 RAG Documentation Enhancement - ${summary.successful} files to improve`
      const prBody = this.generatePRDescription(proposedEnhancements, summary)

      const { data: prData } = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: prTitle,
        head: branchName,
        base: defaultBranch,
        body: prBody,
      })

      console.log(
        `✅ [GitHub PR] Created PR #${prData.number}: ${prData.html_url}`,
      )
      console.log(
        `📋 [GitHub PR] Note: Local files remain unchanged until PR is merged`,
      )

      return {
        success: true,
        prNumber: prData.number,
        prUrl: prData.html_url,
        branch: branchName,
      }
    } catch (error) {
      console.error('❌ [GitHub PR] Error creating PR:', error.message)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Commit a proposed enhanced file to the branch (from memory, not disk)
   */
  async commitProposedEnhancement(branchName, enhancement) {
    try {
      // Use the enhanced content from memory (not reading from disk)
      const enhancedContent = enhancement.enhancedContent

      // Convert absolute path to relative path for GitHub
      const relativePath = enhancement.relativePath

      // Get current file SHA for update (if file exists)
      let currentFileSha = null
      try {
        const { data: currentFile } = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: relativePath,
          ref: branchName,
        })
        currentFileSha = currentFile.sha
      } catch (error) {
        // File might not exist, that's okay
        console.log(`📄 [GitHub PR] New file: ${relativePath}`)
      }

      // Create or update the file with proposed enhanced content
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: relativePath,
        message: `🤖 Propose RAG enhancement for ${path.basename(
          enhancement.filePath,
        )}`,
        content: Buffer.from(enhancedContent).toString('base64'),
        branch: branchName,
        ...(currentFileSha && { sha: currentFileSha }),
      })

      console.log(`📤 [GitHub PR] Proposed enhancement: ${relativePath}`)
    } catch (error) {
      console.error(
        `❌ [GitHub PR] Error committing ${enhancement.filePath}:`,
        error.message,
      )
    }
  }

  /**
   * Generate comprehensive PR description showing proposed changes
   */
  generatePRDescription(proposedEnhancements, summary) {
    const successful = proposedEnhancements.filter(e => e.enhancedContent)

    let description = `## 🤖 Proposed RAG Documentation Enhancement

This PR contains **proposed enhancements** generated by the RAG Prep Plugin to optimize documentation for better search and retrieval.

> **⚠️ Important**: These are proposed changes only. Local files remain unchanged until this PR is reviewed and merged.

### 📊 Enhancement Proposal Summary
- **Files to Enhance**: ${summary.successful}/${summary.totalFiles}
- **Average Proposed RAG Score**: ${summary.averageRagScore}/100
- **Enhancement Success Rate**: ${Math.round(
      (summary.successful / summary.totalFiles) * 100,
    )}%

### 🎯 Proposed Improvements
`

    // Add improvement breakdown
    if (summary.topImprovements) {
      summary.topImprovements.forEach(improvement => {
        description += `- **${improvement.type}**: Proposed for ${improvement.count} files\n`
      })
    }

    if (summary.topAddedFields && summary.topAddedFields.length > 0) {
      description += `\n### 🏷️ New Metadata Fields to Add
`
      summary.topAddedFields.forEach(field => {
        description += `- **${field.field}**: Will be added to ${field.count} files\n`
      })
    }

    description += `
### 📁 Files with Proposed Enhancements
`

    // List enhanced files with their proposed improvements
    successful.forEach(enhancement => {
      const fileName = path.basename(enhancement.filePath)
      const addedFields = enhancement.addedFields || []

      description += `
#### 📄 \`${fileName}\`
- **New Fields**: ${addedFields.join(', ') || 'Metadata updates'}
- **Proposed RAG Score**: ${enhancement.ragScore || 'N/A'}/100
- **Improvements**: ${
        enhancement.improvements
          ? enhancement.improvements.join(', ')
          : 'Enhanced metadata'
      }
`
    })

    description += `
### 🔍 How These Changes Will Improve RAG Performance
- **Better Search Discovery**: Enhanced keywords and descriptions improve findability
- **Richer Context**: Topic categorization helps AI understand content relationships  
- **Query Optimization**: User intent metadata improves search relevance
- **Technical Context**: Stack and API metadata enables precise technical assistance
- **Cross-References**: Related document links create better knowledge graphs

### ✅ Review Checklist
- [ ] Review enhanced frontmatter for accuracy
- [ ] Verify topic categorizations are appropriate  
- [ ] Check that related document links are correct
- [ ] Confirm technical metadata is up-to-date
- [ ] Ensure RAG scores reflect content quality
- [ ] Validate that added fields provide value

### 🚀 Merging This PR
- **Before merge**: Files remain unchanged locally
- **After merge**: Enhanced metadata will be applied to documentation
- **Effect**: Immediate improvement in search and AI retrieval quality

---
*This enhancement proposal was generated by [RAG Prep Plugin](https://github.com/yourusername/docusaurus-rag-prep-plugin)*
*🤖 Human review and approval ensures quality before applying changes*
`

    return description
  }
}

module.exports = GitHubPRTool
