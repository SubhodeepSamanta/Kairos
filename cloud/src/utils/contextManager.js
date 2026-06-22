// Context Size Management and Token Optimization
// Manages context size, token usage, and compression for efficient AI processing

import fs from 'fs';
import path from 'path';

// Token counting utilities
const tokenUtils = {
  // Approximate token counting (GPT-style tokenizer)
  countTokens(text) {
    if (!text) return 0;
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    const baseTokens = Math.ceil(text.length / 4);
    
    // Account for special characters and patterns
    const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
    const specialTokenPenalty = Math.ceil(specialChars / 2);
    
    // Account for common multi-word patterns
    const multiWordPatterns = text.match(/\b\w+\s+\w+\s+\w+\s+\w+\s+\w+/g) || [];
    const multiWordBonus = multiWordPatterns.length * 0.5;
    
    return Math.ceil(baseTokens + specialTokenPenalty - multiWordBonus);
  },

  // Count tokens in an object (recursive)
  countObjectTokens(obj, depth = 0) {
    if (depth > 10) return 0; // Prevent infinite recursion
    
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'string') return this.countTokens(obj);
    if (typeof obj === 'number') return 1;
    if (typeof obj === 'boolean') return 1;
    
    if (Array.isArray(obj)) {
      return obj.reduce((total, item) => total + this.countObjectTokens(item, depth + 1), 0);
    }
    
    if (typeof obj === 'object') {
      return Object.values(obj).reduce((total, value) => total + this.countObjectTokens(value, depth + 1), 0);
    }
    
    return 0;
  },

  // Estimate tokens for a message (system + user)
  estimateMessageTokens(systemPrompt, userPrompt, context) {
    const systemTokens = this.countTokens(systemPrompt);
    const userTokens = this.countTokens(userPrompt);
    const contextTokens = this.countObjectTokens(context);
    
    return systemTokens + userTokens + contextTokens;
  }
};

// Context compression utilities
const compressionUtils = {
  // Compress context by removing redundant information
  compressContext(context, maxTokens = 1000) {
    if (!context || tokenUtils.countObjectTokens(context) <= maxTokens) {
      return context;
    }
    
    const compressed = {};
    
    // Always keep essential fields
    const essentialFields = ['url', 'title', 'pageType', 'site', 'environment'];
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
    
    return summary;
  }
};

// Token budget manager
class TokenBudgetManager {
  constructor() {
    this.budgets = {
      system: 4000,      // System prompt budget
      user: 8000,        // User prompt budget
      context: 2000,     // Context budget
      total: 200000      // Total LLM call budget
    };
    this.currentUsage = {
      system: 0,
      user: 0,
      context: 0,
      total: 0
    };
    this.callHistory = [];
    this.optimizationStrategies = {
      aggressive: false,
      compressContext: true,
      summarizeContext: true,
      prioritizeEssential: true
    };
  }

  // Check if we have enough budget for a request
  canMakeRequest(systemPrompt, userPrompt, context) {
    const estimatedTokens = tokenUtils.estimateMessageTokens(systemPrompt, userPrompt, context);
    return this.currentUsage.total + estimatedTokens <= this.budgets.total;
  }

  // Allocate tokens for a request
  allocateTokens(systemPrompt, userPrompt, context) {
    const estimatedTokens = tokenUtils.estimateMessageTokens(systemPrompt, userPrompt, context);
    
    if (!this.canMakeRequest(systemPrompt, userPrompt, context)) {
      throw new Error(`Token budget exceeded: need ${estimatedTokens} tokens, have ${this.budgets.total - this.currentUsage.total} remaining`);
    }
    
    this.currentUsage.total += estimatedTokens;
    this.currentUsage.system += tokenUtils.countTokens(systemPrompt);
    this.currentUsage.user += tokenUtils.countTokens(userPrompt);
    this.currentUsage.context += tokenUtils.countObjectTokens(context);
    
    this.callHistory.push({
      timestamp: Date.now(),
      systemTokens: tokenUtils.countTokens(systemPrompt),
      userTokens: tokenUtils.countTokens(userPrompt),
      contextTokens: tokenUtils.countObjectTokens(context),
      totalTokens: estimatedTokens
    });
    
    return {
      allocated: estimatedTokens,
      remaining: this.budgets.total - this.currentUsage.total,
      usage: { ...this.currentUsage }
    };
  }

  // Reset usage for a new session
  resetUsage() {
    this.currentUsage = {
      system: 0,
      user: 0,
      context: 0,
      total: 0
    };
    this.callHistory = [];
    console.log('[TOKEN BUDGET] Token usage reset for new session');
  }

  // Get current usage statistics
  getUsageStats() {
    return {
      current: { ...this.currentUsage },
      budgets: { ...this.budgets },
      callHistory: this.callHistory,
      optimizationStrategies: { ...this.optimizationStrategies }
    };
  }

  // Optimize context based on available budget
  optimizeContext(context, systemPrompt, userPrompt) {
    const estimatedTokens = tokenUtils.estimateMessageTokens(systemPrompt, userPrompt, context);
    const totalEstimated = estimatedTokens + this.currentUsage.total;
    
    if (totalEstimated <= this.budgets.total * 0.9) {
      return context; // No optimization needed
    }
    
    // Apply optimization strategies
    let optimizedContext = context;
    
    if (this.optimizationStrategies.compressContext) {
      optimizedContext = compressionUtils.compressContext(optimizedContext, 1000);
    }
    
    if (this.optimizationStrategies.summarizeContext) {
      const summary = compressionUtils.summarizeContext(optimizedContext);
      optimizedContext = { ...summary };
    }
    
    if (this.optimizationStrategies.prioritizeEssential) {
      optimizedContext = this.prioritizeEssentialFields(optimizedContext);
    }
    
    return optimizedContext;
  }

  // Prioritize essential fields
  prioritizeEssentialFields(context) {
    const essentialFields = ['url', 'title', 'pageType', 'site', 'environment', 'goals'];
    const optimized = {};
    
    essentialFields.forEach(field => {
      if (context[field] !== undefined) {
        optimized[field] = context[field];
      }
    });
    
    // Add a few key elements if available
    if (context.importantElements && context.importantElements.length > 0) {
      optimized.keyElements = context.importantElements.slice(0, 5);
    }
    
    return optimized;
  }

  // Update optimization strategies
  updateOptimizationStrategies(strategies) {
    Object.assign(this.optimizationStrategies, strategies);
    console.log('[TOKEN BUDGET] Optimization strategies updated:', this.optimizationStrategies);
  }
}

// Context manager
class ContextManager {
  constructor() {
    this.tokenBudget = new TokenBudgetManager();
    this.contextHistory = [];
    this.maxContextHistory = 100;
    this.contextCompressionEnabled = true;
    this.tokenOptimizationEnabled = true;
  }

  // Create a new context
  createContext(initialData = {}) {
    const context = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      timestamp: Date.now(),
      ...initialData
    };
    
    this.contextHistory.push(context);
    if (this.contextHistory.length > this.maxContextHistory) {
      this.contextHistory.shift();
    }
    
    return context;
  }

  // Update context with new data
  updateContext(contextId, updates) {
    const context = this.contextHistory.find(c => c.id === contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    Object.assign(context, updates);
    context.timestamp = Date.now();
    
    return context;
  }

  // Get context by ID
  getContext(contextId) {
    if (contextId && typeof contextId === 'object') {
      const id = contextId.id;
      return this.contextHistory.find(c => c.id === id);
    }
    return this.contextHistory.find(c => c.id === contextId);
  }

  // Optimize context for LLM consumption
  async optimizeContextForLLM(contextId, systemPrompt, userPrompt) {
    const context = this.getContext(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    let optimizedContext = context;
    
    if (this.tokenOptimizationEnabled) {
      optimizedContext = this.tokenBudget.optimizeContext(optimizedContext, systemPrompt, userPrompt);
    }
    
    return optimizedContext;
  }

  // Make LLM call with context management
  async makeLLMCall(contextId, systemPrompt, userPrompt, llmFunction) {
    const context = this.getContext(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }
    
    // Optimize context if needed
    const optimizedContext = await this.optimizeContextForLLM(contextId, systemPrompt, userPrompt);
    
    // Check token budget
    if (!this.tokenBudget.canMakeRequest(systemPrompt, userPrompt, optimizedContext)) {
      throw new Error('Token budget exceeded');
    }
    
    // Allocate tokens
    const allocation = this.tokenBudget.allocateTokens(systemPrompt, userPrompt, optimizedContext);
    
    try {
      // Make the LLM call
      const result = await llmFunction(systemPrompt, userPrompt, optimizedContext);
      
      // Update context with result
      await this.updateContext(contextId, {
        lastLLMCall: {
          timestamp: Date.now(),
          tokensUsed: allocation.allocated,
          systemTokens: allocation.usage.system,
          userTokens: allocation.usage.user,
          contextTokens: allocation.usage.context
        },
        lastResult: result
      });
      
      return result;
      
    } catch (error) {
      // Log error and rethrow
      console.error('[CONTEXT MANAGER] LLM call failed:', error.message);
      throw error;
    }
  }

  // Get context statistics
  getContextStats() {
    return {
      totalContexts: this.contextHistory.length,
      tokenBudget: this.tokenBudget.getUsageStats(),
      recentContexts: this.contextHistory.slice(-10)
    };
  }

  // Reset everything
  reset() {
    this.tokenBudget.resetUsage();
    this.contextHistory = [];
    console.log('[CONTEXT MANAGER] Context manager reset');
  }
}

// Global context manager instance
const contextManager = new ContextManager();

// Export utilities
export { tokenUtils, compressionUtils, ContextManager };
export default contextManager;

// Export convenience functions
export async function makeOptimizedLLMCall(contextId, systemPrompt, userPrompt, llmFunction) {
  return contextManager.makeLLMCall(contextId, systemPrompt, userPrompt, llmFunction);
}

export function createOptimizedContext(initialData = {}) {
  return contextManager.createContext(initialData);
}

export function getContextStats() {
  return contextManager.getContextStats();
}

console.log('[CONTEXT MANAGER] Context size management and token optimization initialized');