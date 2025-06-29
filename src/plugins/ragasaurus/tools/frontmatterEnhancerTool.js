const fs = require('fs-extra')
const matter = require('gray-matter')
const path = require('path')

/**
 * Frontmatter Enhancer Tool
 * Writes enhanced metadata back to markdown files
 */
class FrontmatterEnhancerTool {
  constructor() {
    this.name = 'frontmatter-enhancer'
    this.description =
      'Enhances markdown file frontmatter with AI-generated metadata'
  }

  /**
   * Enhance a markdown file with new frontmatter
   */
  async enhanceFile(filePath, enhancedMetadata, originalContent) {
    try {
      console.log(`📝 [Frontmatter Tool] Enhancing: ${path.basename(filePath)}`)

      // Parse the original file
      const parsed = matter(originalContent)

      // Clean and simplify the enhanced metadata for maximum YAML compatibility
      const cleanedMetadata = this.cleanMetadataForSimpleYaml(enhancedMetadata)

      // Merge original metadata with enhancements (enhanced takes precedence)
      const mergedMetadata = {
        ...parsed.data,
        ...cleanedMetadata,
        // Add processing metadata
        enhanced_by: 'rag-prep-plugin',
        enhanced_at: new Date().toISOString(),
        original_title: parsed.data.title || 'Untitled',
      }

      // Reconstruct the file with enhanced frontmatter using clean YAML
      const enhancedFile = matter.stringify(parsed.content, mergedMetadata, {
        // Force simple YAML output - no references, no complex syntax
        noRefs: true,
        flowLevel: -1,
      })

      // Write the enhanced file back
      await fs.writeFile(filePath, enhancedFile, 'utf8')

      console.log(`✅ [Frontmatter Tool] Enhanced: ${path.basename(filePath)}`)

      return {
        success: true,
        filePath,
        enhancedMetadata: mergedMetadata,
        addedFields: Object.keys(cleanedMetadata).filter(
          key => !parsed.data[key],
        ),
      }
    } catch (error) {
      console.error(
        `❌ [Frontmatter Tool] Error enhancing ${filePath}:`,
        error.message,
      )
      return {
        success: false,
        filePath,
        error: error.message,
      }
    }
  }

  /**
   * Clean metadata to ensure simple, compatible YAML output
   */
  cleanMetadataForSimpleYaml(enhancedMetadata) {
    const cleaned = {}

    // Clean description - ensure it's a simple string
    if (enhancedMetadata.description) {
      cleaned.description = enhancedMetadata.description
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/"/g, "'") // Replace quotes to avoid YAML escaping issues
    }

    // Clean arrays - ensure they're simple string arrays
    ;['tags', 'keywords', 'topics', 'related'].forEach(field => {
      if (enhancedMetadata[field] && Array.isArray(enhancedMetadata[field])) {
        cleaned[field] = enhancedMetadata[field]
          .filter(item => item && typeof item === 'string' && item.trim())
          .map(item => item.trim().replace(/"/g, "'"))
          .slice(0, 10) // Limit array size

        // Ensure at least one value for critical fields
        if (
          (field === 'tags' || field === 'keywords') &&
          cleaned[field].length === 0
        ) {
          cleaned[field] = ['documentation']
        }
      }
    })

    // Clean improvements array - ensure simple strings
    if (
      enhancedMetadata.rag_improvements &&
      Array.isArray(enhancedMetadata.rag_improvements)
    ) {
      cleaned.ragImprovements = enhancedMetadata.rag_improvements
        .filter(item => item && typeof item === 'string')
        .map(item =>
          item
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/"/g, "'"),
        )
        .slice(0, 5) // Limit to 5 improvements
    } else if (
      enhancedMetadata.ragImprovements &&
      Array.isArray(enhancedMetadata.ragImprovements)
    ) {
      cleaned.ragImprovements = enhancedMetadata.ragImprovements
        .filter(item => item && typeof item === 'string')
        .map(item =>
          item
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/"/g, "'"),
        )
        .slice(0, 5)
    }

    // Simple scalar values - avoid any complex types
    if (
      enhancedMetadata.category &&
      typeof enhancedMetadata.category === 'string'
    ) {
      cleaned.category = enhancedMetadata.category.trim()
    }

    if (
      enhancedMetadata.difficulty &&
      typeof enhancedMetadata.difficulty === 'string'
    ) {
      cleaned.difficulty = enhancedMetadata.difficulty.trim()
    }

    // Use ONLY camelCase for scores - avoid duplicates
    if (typeof enhancedMetadata.ragScore === 'number') {
      cleaned.ragScore = enhancedMetadata.ragScore
    } else if (typeof enhancedMetadata.rag_score === 'number') {
      cleaned.ragScore = enhancedMetadata.rag_score
    }

    // Ensure title is clean
    if (enhancedMetadata.title && typeof enhancedMetadata.title === 'string') {
      cleaned.title = enhancedMetadata.title.trim()
    }

    return cleaned
  }

  /**
   * Create a backup of the original file before enhancement
   */
  async createBackup(filePath) {
    try {
      const backupPath = filePath.replace('.md', '.original.md')
      await fs.copy(filePath, backupPath)
      console.log(
        `💾 [Frontmatter Tool] Backup created: ${path.basename(backupPath)}`,
      )
      return backupPath
    } catch (error) {
      console.error(
        `❌ [Frontmatter Tool] Backup failed for ${filePath}:`,
        error.message,
      )
      return null
    }
  }

  /**
   * Batch enhance multiple files
   */
  async enhanceFiles(fileEnhancements) {
    console.log(
      `🚀 [Frontmatter Tool] Batch enhancing ${fileEnhancements.length} files...`,
    )

    const results = []

    for (const enhancement of fileEnhancements) {
      const { filePath, enhancedMetadata, originalContent } = enhancement

      // Skip backup creation since originals are stored elsewhere
      console.log(
        `📝 [Frontmatter Tool] Enhancing (no backup): ${path.basename(
          filePath,
        )}`,
      )

      // Enhance the file
      const result = await this.enhanceFile(
        filePath,
        enhancedMetadata,
        originalContent,
      )
      results.push(result)
    }

    const successful = results.filter(r => r.success).length
    console.log(
      `📊 [Frontmatter Tool] Batch complete: ${successful}/${fileEnhancements.length} files enhanced`,
    )

    return results
  }

  /**
   * Generate summary of enhancements made
   */
  generateSummary(results) {
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    const addedFieldsSummary = {}
    successful.forEach(result => {
      result.addedFields?.forEach(field => {
        addedFieldsSummary[field] = (addedFieldsSummary[field] || 0) + 1
      })
    })

    return {
      totalFiles: results.length,
      successful: successful.length,
      failed: failed.length,
      failedFiles: failed.map(f => f.filePath),
      addedFields: addedFieldsSummary,
      summary: `Enhanced ${
        successful.length
      } files. Most common additions: ${Object.entries(addedFieldsSummary)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([field, count]) => `${field} (${count})`)
        .join(', ')}`,
    }
  }
}

module.exports = FrontmatterEnhancerTool
