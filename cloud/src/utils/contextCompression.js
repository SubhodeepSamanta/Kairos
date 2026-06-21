// Context Compression and Summarization System
// Compresses and summarizes context to reduce token usage and improve efficiency

const fs = require('fs');
const path = require('path');

// Context compression and summarization utilities
const compressionUtils = {
  // Compress context for LLM consumption
  compressContext(context, maxTokens = 1000) {
    if (!context || tokenUtils.countObjectTokens(context) <= maxTokens) {
      return context;
    }
    
    const compressed = {};
    
    // Always keep essential fields
    const essentialFields = ['url', 'title', 'pageType', 'site', 'environment', 'goals'];
    essentialFields.forEach(field => {
      if (context[field] !== undefined) {
        compressed[field] = context[field];
      }
    });
    
    // Add important elements if space allows
    if (tokenUtils.countObjectTokens(compressed) < maxTokens * 0.7 && context.importantElements) {
      compressed.importantElements = context.importantElements.slice(0, 10);
    }
    
    // Add recent observations if space allows
    if (tokenUtils.countObjectTokens(compressed) < maxTokens * 0.8 && context.recentObservations) {
      compressed.recentObservations = context.recentObservations.slice(-3);
    }
    
    // Add key findings if space allows
    if (tokenUtils.countObjectTokens(compressed) < maxTokens * 0.9 && context.keyFindings) {
      compressed.keyFindings = context.keyFindings.slice(-2);
    }
    
    // Add workflow memory if space allows
    if (tokenUtils.countObjectTokens(compressed) < maxTokens * 0.95 && context.workflowMemory) {
      compressed.workflowMemory = {
        currentSubObjective: context.workflowMemory.currentSubObjective,
        completedSubObjectives: context.workflowMemory.completedSubObjectives,
        subObjectives: context.workflowMemory.subObjectives
      };
    }
    
    return compressed;
  },

  // Summarize context for LLM consumption
  summarizeContext(context) {
    const summary = {
      pageType: context.pageType || 'unknown',
      url: context.url || '',
      title: context.title || '',
      keyElements: [],
      recentActions: [],
      goals: context.goals || []
    };
    
    // Extract key elements
    if (context.importantElements) {
      summary.keyElements = context.importantElements
        .filter(el => el.purpose && el.purpose !== 'generic')
        .slice(0, 5)
        .map(el => `${el.role}: ${el.purpose} (${el.label || 'no label'})`);
    }
    
    // Extract recent actions
    if (context.recentActions) {
      summary.recentActions = context.recentActions.slice(-3);
    }
    
    // Extract key findings
    if (context.keyFindings) {
      summary.keyFindings = context.keyFindings.slice(-2);
    }
    
    // Extract workflow memory
    if (context.workflowMemory) {
      summary.workflowMemory = {
        currentSubObjective: context.workflowMemory.currentSubObjective,
        completedSubObjectives: context.workflowMemory.completedSubObjectives,
        subObjectives: context.workflowMemory.subObjectives
      };
    }
    
    return summary;
  },

  // Create context summary for LLM
  createContextSummary(context, maxTokens = 500) {
    const summary = this.summarizeContext(context);
    const summaryTokens = tokenUtils.countObjectTokens(summary);
    
    if (summaryTokens <= maxTokens) {
      return summary;
    }
    
    // If summary is too large, create a more compact version
    const compactSummary = {
      pageType: context.pageType || 'unknown',
      url: context.url || '',
      title: context.title || '',
      keyElements: summary.keyElements.slice(0, 3),
      goals: context.goals || []
    };
    
    return compactSummary;
  },

  // Compress browser state for LLM consumption
  compressBrowserState(browserState, maxTokens = 300) {
    if (!browserState) return {};
    
    const compressed = {
      url: browserState.url || '',
      title: browserState.title || '',
      pageType: browserState.pageType || '',
      site: browserState.site || '',
      environment: browserState.environment || '',
      importantElements: browserState.importantElements?.slice(0, 5) || [],
      inputs: browserState.inputs?.slice(0, 5) || [],
      buttons: browserState.buttons?.slice(0, 5) || [],
      links: browserState.links?.slice(0, 10) || []
    };
    
    const compressedTokens = tokenUtils.countObjectTokens(compressed);
    if (compressedTokens > maxTokens) {
      // Further compress if needed
      compressed.importantElements = compressed.importantElements.slice(0, 3);
      compressed.inputs = compressed.inputs.slice(0, 3);
      compressed.buttons = compressed.buttons.slice(0, 3);
      compressed.links = compressed.links.slice(0, 5);
    }
    
    return compressed;
  },

  // Compress world model for LLM consumption
  compressWorldModel(worldModel, maxTokens = 400) {
    if (!worldModel) return {};
    
    const compressed = {
      findings: worldModel.findings?.slice(-3) || [],
      actionHistory: worldModel.actionHistory?.slice(-5) || [],
      currentState: worldModel.currentState || {},
      goals: worldModel.goals || []
    };
    
    const compressedTokens = tokenUtils.countObjectTokens(compressed);
    if (compressedTokens > maxTokens) {
      // Further compress if needed
      compressed.findings = compressed.findings.slice(-2);
      compressed.actionHistory = compressed.actionHistory.slice(-3);
    }
    
    return compressed;
  }
};

// Context compression manager
class ContextCompressionManager {
  constructor() {
    this.compressionEnabled = true;
    this.summarizationEnabled = true;
    this.compressionStats = {
      totalCompressions: 0,
      totalSummaries: 0,
      averageCompressionRatio: 0,
      lastCompression: null
    };
  }

  // Compress context for LLM
  compressContextForLLM(context, systemPrompt, userPrompt, maxTokens = 1000) {
    if (!this.compressionEnabled) {
      return context;
    }
    
    const estimatedTokens = tokenUtils.estimateMessageTokens(systemPrompt, userPrompt, context);
    const compressionRatio = estimatedTokens > 0 ? Math.min(1, maxTokens / estimatedTokens) : 1;
    
    let compressedContext = context;
    
    if (compressionRatio < 0.8) {
      // Apply compression
      compressedContext = compressionUtils.compressContext(compressedContext, maxTokens);
      this.compressionStats.totalCompressions++;
    }
    
    // Apply summarization if enabled
    if (this.summarizationEnabled) {
      const summary = compressionUtils.createContextSummary(compressedContext, maxTokens * 0.5);
      compressedContext = summary;
      this.compressionStats.totalSummaries++;
    }
    
    // Update statistics
    this.compressionStats.lastCompression = Date.now();
    const currentAverage = this.compressionStats.averageCompressionRatio;
    this.compressionStats.averageCompressionRatio = 
      (currentAverage * (this.compressionStats.totalCompressions - 1) + compressionRatio) / 
      this.compressionStats.totalCompressions;
    
    console.log(`[CONTEXT COMPRESSION] Compressed context: ${compressionRatio.toFixed(2)} ratio, ${estimatedTokens} → ${tokenUtils.countObjectTokens(compressedContext)} tokens`);
    
    return compressedContext;
  }

  // Compress browser state for LLM
  compressBrowserStateForLLM(browserState, maxTokens = 300) {
    if (!browserState) return {};
    
    return compressionUtils.compressBrowserState(browserState, maxTokens);
  }

  // Compress world model for LLM
  compressWorldModelForLLM(worldModel, maxTokens = 400) {
    if (!worldModel) return {};
    
    return compressionUtils.compressWorldModel(worldModel, maxTokens);
  }

  // Get compression statistics
  getCompressionStats() {
    return {
      ...this.compressionStats,
      compressionEnabled: this.compressionEnabled,
      summarizationEnabled: this.summarizationEnabled
    };
  }

  // Enable or disable compression
  setCompressionEnabled(enabled) {
    this.compressionEnabled = enabled;
    console.log(`[CONTEXT COMPRESSION] Compression ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Enable or disable summarization
  setSummarizationEnabled(enabled) {
    this.summarizationEnabled = enabled;
    console.log(`[CONTEXT COMPRESSION] Summarization ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Global context compression manager instance
const contextCompressionManager = new ContextCompressionManager();

// Export context compression utilities
export { compressionUtils, ContextCompressionManager };
export default contextCompressionManager;

// Export convenience functions
export function compressContextForLLM(context, systemPrompt, userPrompt, maxTokens = 1000) {
  return contextCompressionManager.compressContextForLLM(context, systemPrompt, userPrompt, maxTokens);
}

export function compressBrowserStateForLLM(browserState, maxTokens = 300) {
  return contextCompressionManager.compressBrowserStateForLLM(browserState, maxTokens);
}

export function compressWorldModelForLLM(worldModel, maxTokens = 400) {
  return contextCompressionManager.compressWorldModelForLLM(worldModel, maxTokens);
}

export function getCompressionStats() {
  return contextCompressionManager.getCompressionStats();
}

export function setCompressionEnabled(enabled) {
  contextCompressionManager.setCompressionEnabled(enabled);
}

export function setSummarizationEnabled(enabled) {
  contextCompressionManager.setSummarizationEnabled(enabled);
}

console.log('[CONTEXT COMPRESSION] Context compression and summarization initialized');