// Dynamic Resource Allocation and Action Limits
// Replaces hardcoded action limits with intelligent resource management

const fs = require('fs');
const path = require('path');

// Resource allocation statistics
const resourceStats = {
  actionLimits: {
    default: 30,
    adaptive: 30,
    max: 100,
    min: 5
  },
  llmCallLimits: {
    default: 80,
    adaptive: 80,
    max: 200,
    min: 20
  },
  tokenLimits: {
    default: 20000,
    adaptive: 20000,
    max: 100000,
    min: 5000
  },
  learningHistory: [],
  adaptationCount: 0,
  lastAdaptation: null
};

// Resource allocation and optimization system
class DynamicResourceAllocator {
  constructor() {
    this.currentLimits = {
      maxActions: resourceStats.actionLimits.adaptive,
      maxLlmCalls: resourceStats.llmCallLimits.adaptive,
      maxTokens: resourceStats.tokenLimits.adaptive
    };
    this.usageStats = {
      actionsUsed: 0,
      llmCallsUsed: 0,
      tokensUsed: 0,
      currentSessionActions: 0,
      currentSessionLlmCalls: 0,
      currentSessionTokens: 0
    };
    this.adaptationStrategies = {
      aggressive: false,
      conservative: false,
      balanced: true
    };
    this.performanceHistory = [];
  }

  // Calculate adaptive action limits based on performance
  calculateAdaptiveLimits(goal, browserState, performanceHistory) {
    const adaptations = [];
    let newMaxActions = this.currentLimits.maxActions;
    let newMaxLlmCalls = this.currentLimits.maxLlmCalls;
    let newMaxTokens = this.currentLimits.maxTokens;
    
    // Adapt based on goal complexity
    const goalComplexity = this.calculateGoalComplexity(goal);
    if (goalComplexity > 0.8) {
      // Complex goals need more resources
      newMaxActions = Math.min(resourceStats.actionLimits.max, Math.ceil(newMaxActions * 1.5));
      newMaxLlmCalls = Math.min(resourceStats.llmCallLimits.max, Math.ceil(newMaxLlmCalls * 1.3));
      adaptations.push({
        type: 'complexity_increase',
        reason: 'Goal complexity requires more resources',
        actions: newMaxActions,
        llmCalls: newMaxLlmCalls
      });
    } else if (goalComplexity < 0.3) {
      // Simple goals need fewer resources
      newMaxActions = Math.max(resourceStats.actionLimits.min, Math.floor(newMaxActions * 0.7));
      newMaxLlmCalls = Math.max(resourceStats.llmCallLimits.min, Math.floor(newMaxLlmCalls * 0.7));
      adaptations.push({
        type: 'complexity_reduction',
        reason: 'Goal simplicity allows resource reduction',
        actions: newMaxActions,
        llmCalls: newMaxLlmCalls
      });
    }
    
    // Adapt based on browser state
    if (browserState) {
      const pageLoadTime = browserState.pageLoadTime || 0;
      const pageSize = browserState.pageSize || 0;
      
      if (pageLoadTime > 5000) {
        // Slow loading pages need more time and resources
        newMaxActions = Math.min(resourceStats.actionLimits.max, newMaxActions + 5);
        adaptations.push({
          type: 'performance_adjustment',
          reason: 'Slow page loading requires more resources',
          actions: newMaxActions
        });
      }
      
      if (pageSize > 100000) {
        // Large pages need more tokens for context
        newMaxTokens = Math.min(resourceStats.tokenLimits.max, newMaxTokens + 5000);
        adaptations.push({
          type: 'content_adjustment',
          reason: 'Large page content requires more tokens',
          tokens: newMaxTokens
        });
      }
    }
    
    // Adapt based on performance history
    if (performanceHistory && performanceHistory.length > 0) {
      const recentSuccessRate = this.calculateSuccessRate(performanceHistory);
      const recentEfficiency = this.calculateEfficiency(performanceHistory);
      
      if (recentSuccessRate < 0.5) {
        // Low success rate - be more conservative
        newMaxActions = Math.max(resourceStats.actionLimits.min, Math.floor(newMaxActions * 0.8));
        adaptations.push({
          type: 'success_rate_adjustment',
          reason: 'Low success rate requires conservative resource allocation',
          actions: newMaxActions
        });
      } else if (recentEfficiency > 0.8) {
        // High efficiency - can be more aggressive
        newMaxActions = Math.min(resourceStats.actionLimits.max, Math.ceil(newMaxActions * 1.2));
        adaptations.push({
          type: 'efficiency_adjustment',
          reason: 'High efficiency allows aggressive resource allocation',
          actions: newMaxActions
        });
      }
    }
    
    // Update current limits
    this.currentLimits.maxActions = newMaxActions;
    this.currentLimits.maxLlmCalls = newMaxLlmCalls;
    this.currentLimits.maxTokens = newMaxTokens;
    
    resourceStats.adaptationCount++;
    resourceStats.lastAdaptation = Date.now();
    
    console.log(`[RESOURCE ALLOCATOR] Applied ${adaptations.length} resource adaptations:
${adaptations.map(a => `  - ${a.type}: ${a.reason}`).join('\n')}
New limits: Actions=${newMaxActions}, LLM Calls=${newMaxLlmCalls}, Tokens=${newMaxTokens}`);
    
    return {
      maxActions: newMaxActions,
      maxLlmCalls: newMaxLlmCalls,
      maxTokens: newMaxTokens,
      adaptations: adaptations
    };
  }

  // Calculate goal complexity
  calculateGoalComplexity(goal) {
    const objective = (goal.objective || "").toLowerCase();
    const complexityFactors = {
      search: 0.8,
      navigate: 0.6,
      extract: 0.7,
      click: 0.5,
      type: 0.5,
      scroll: 0.3,
      back: 0.2,
      refresh: 0.1
    };
    
    let complexity = 0;
    const words = objective.split(' ');
    
    words.forEach(word => {
      Object.keys(complexityFactors).forEach(pattern => {
        if (word.includes(pattern)) {
          complexity += complexityFactors[pattern];
        }
      });
    });
    
    // Normalize complexity
    return Math.min(1.0, complexity / words.length || 0.5);
  }

  // Calculate success rate from performance history
  calculateSuccessRate(history) {
    if (!history || history.length === 0) return 0.5;
    
    const successfulActions = history.filter(h => h.success).length;
    return successfulActions / history.length;
  }

  // Calculate efficiency from performance history
  calculateEfficiency(history) {
    if (!history || history.length === 0) return 0.5;
    
    const totalActions = history.length;
    const successfulActions = history.filter(h => h.success).length;
    const avgActionsPerSuccess = totalActions / successfulActions || 1;
    
    // Efficiency: actions per successful outcome (lower is better)
    return Math.max(0, 1 - (avgActionsPerSuccess - 1) * 0.2);
  }

  // Check if we have enough resources for a new action
  canExecuteAction(currentActions, currentLlmCalls, currentTokens) {
    return currentActions < this.currentLimits.maxActions &&
           currentLlmCalls < this.currentLimits.maxLlmCalls &&
           currentTokens < this.currentLimits.maxTokens;
  }

  // Allocate resources for an action
  allocateResources(actionType, estimatedTokens = 0) {
    this.usageStats.actionsUsed++;
    this.usageStats.currentSessionActions++;
    this.usageStats.llmCallsUsed++;
    this.usageStats.currentSessionLlmCalls++;
    this.usageStats.tokensUsed += estimatedTokens;
    this.usageStats.currentSessionTokens += estimatedTokens;
    
    return {
      actionsRemaining: this.currentLimits.maxActions - this.usageStats.actionsUsed,
      llmCallsRemaining: this.currentLimits.maxLlmCalls - this.usageStats.llmCallsUsed,
      tokensRemaining: this.currentLimits.maxTokens - this.usageStats.tokensUsed,
      currentSession: {
        actions: this.usageStats.currentSessionActions,
        llmCalls: this.usageStats.currentSessionLlmCalls,
        tokens: this.usageStats.currentSessionTokens
      }
    };
  }

  // Reset session resources
  resetSessionResources() {
    this.usageStats.currentSessionActions = 0;
    this.usageStats.currentSessionLlmCalls = 0;
    this.usageStats.currentSessionTokens = 0;
    console.log('[RESOURCE ALLOCATOR] Session resources reset');
  }

  // Get current resource statistics
  getResourceStats() {
    return {
      current: { ...this.currentLimits },
      usage: { ...this.usageStats },
      adaptationStrategies: { ...this.adaptationStrategies },
      performanceHistory: this.performanceHistory.slice(-10)
    };
  }

  // Update performance history
  updatePerformanceHistory(action, success, executionTime) {
    this.performanceHistory.push({
      timestamp: Date.now(),
      action: action,
      success: success,
      executionTime: executionTime
    });
    
    // Keep only recent history
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.splice(0, this.performanceHistory.length - 100);
    }
  }

  // Set adaptation strategies
  setAdaptationStrategies(strategies) {
    Object.assign(this.adaptationStrategies, strategies);
    console.log('[RESOURCE ALLOCATOR] Adaptation strategies updated:', this.adaptationStrategies);
  }
}

// Global resource allocator instance
const resourceAllocator = new DynamicResourceAllocator();

// Export resource allocator
export { DynamicResourceAllocator, resourceAllocator };
export default resourceAllocator;

// Export convenience functions
export function calculateAdaptiveLimits(goal, browserState, performanceHistory) {
  return resourceAllocator.calculateAdaptiveLimits(goal, browserState, performanceHistory);
}

export function canExecuteAction(currentActions, currentLlmCalls, currentTokens) {
  return resourceAllocator.canExecuteAction(currentActions, currentLlmCalls, currentTokens);
}

export function allocateResources(actionType, estimatedTokens = 0) {
  return resourceAllocator.allocateResources(actionType, estimatedTokens);
}

export function resetSessionResources() {
  resourceAllocator.resetSessionResources();
}

export function getResourceStats() {
  return resourceAllocator.getResourceStats();
}

export function updatePerformanceHistory(action, success, executionTime) {
  resourceAllocator.updatePerformanceHistory(action, success, executionTime);
}

console.log('[RESOURCE ALLOCATOR] Dynamic resource allocation initialized');