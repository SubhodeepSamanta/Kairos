// Adaptive Recovery System with Learning Capabilities
// Replaces hardcoded recovery with intelligent, learning-based recovery mechanisms

import fs from 'fs';
import path from 'path';

// Recovery learning and adaptation system
const recoveryLearning = {
  failurePatterns: new Map(),
  successPatterns: new Map(),
  adaptationHistory: [],
  learningEnabled: true,
  maxPatternHistory: 100,
  confidenceThreshold: 0.7,
  
  // Learn from failures
  learnFromFailure(action, context, outcome) {
    const patternKey = `${action.type}:${context.pagePurpose || 'unknown'}`;
    const failurePattern = {
      action: action,
      context: context,
      outcome: outcome,
      timestamp: Date.now(),
      success: outcome.success === false
    };
    
    if (!this.failurePatterns.has(patternKey)) {
      this.failurePatterns.set(patternKey, []);
    }
    
    const patterns = this.failurePatterns.get(patternKey);
    patterns.push(failurePattern);
    
    // Keep only recent patterns
    if (patterns.length > this.maxPatternHistory) {
      patterns.splice(0, patterns.length - this.maxPatternHistory);
    }
    
    // Analyze failure patterns
    this.analyzeFailurePattern(patternKey, patterns);
    
    console.log(`[RECOVERY LEARNING] Learned from failure: ${patternKey} - ${outcome.reason || 'unknown reason'}`);
  },
  
  // Learn from successes
  learnFromSuccess(action, context, outcome) {
    const patternKey = `${action.type}:${context.pagePurpose || 'unknown'}`;
    const successPattern = {
      action: action,
      context: context,
      outcome: outcome,
      timestamp: Date.now(),
      success: outcome.success === true
    };
    
    if (!this.successPatterns.has(patternKey)) {
      this.successPatterns.set(patternKey, []);
    }
    
    const patterns = this.successPatterns.get(patternKey);
    patterns.push(successPattern);
    
    if (patterns.length > this.maxPatternHistory) {
      patterns.splice(0, patterns.length - this.maxPatternHistory);
    }
    
    console.log(`[RECOVERY LEARNING] Learned from success: ${patternKey}`);
  },
  
  // Analyze failure patterns to identify recovery strategies
  analyzeFailurePattern(patternKey, patterns) {
    const recentFailures = patterns.slice(-10);
    const failureTypes = recentFailures.map(p => p.outcome.reason || 'unknown').filter(r => r);
    const commonReasons = this.getMostCommon(failureTypes);
    
    // Suggest recovery strategies based on common failure reasons
    const suggestedStrategies = [];
    
    if (commonReasons.includes('element_not_found')) {
      suggestedStrategies.push({
        type: 'expand_search',
        description: 'Expand search scope to include more elements',
        confidence: 0.8
      });
    }
    
    if (commonReasons.includes('page_load_timeout')) {
      suggestedStrategies.push({
        type: 'wait_and_retry',
        description: 'Wait longer and retry the action',
        confidence: 0.7
      });
    }
    
    if (commonReasons.includes('action_loop')) {
      suggestedStrategies.push({
        type: 'change_tactics',
        description: 'Change approach to break out of action loop',
        confidence: 0.9
      });
    }
    
    if (commonReasons.includes('insufficient_context')) {
      suggestedStrategies.push({
        type: 'gather_more_context',
        description: 'Gather more page context before retrying',
        confidence: 0.6
      });
    }
    
    console.log(`[RECOVERY LEARNING] Suggested strategies for ${patternKey}: ${suggestedStrategies.map(s => s.type).join(', ')}`);
  },
  
  // Get most common items in an array
  getMostCommon(arr) {
    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([item]) => item);
  },
  
  // Get recovery strategies for a given action and context
  getRecoveryStrategies(action, context) {
    const patternKey = `${action.type}:${context.pagePurpose || 'unknown'}`;
    const strategies = [];
    
    // Get failure patterns for this action
    const failurePatterns = this.failurePatterns.get(patternKey) || [];
    const successPatterns = this.successPatterns.get(patternKey) || [];
    
    // Analyze recent failures
    if (failurePatterns.length > 0) {
      const recentFailures = failurePatterns.slice(-5);
      const commonReasons = this.getMostCommon(recentFailures.map(p => p.outcome.reason || 'unknown').filter(r => r));
      
      // Generate recovery strategies based on common reasons
      if (commonReasons.includes('element_not_found')) {
        strategies.push({
          type: 'expand_search',
          description: 'Expand search scope to include more elements',
          confidence: 0.8,
          actions: [
            { type: 'scroll', params: { direction: 'down', amount: 500 } },
            { type: 'read_ui', params: {} }
          ]
        });
      }
      
      if (commonReasons.includes('action_loop')) {
        strategies.push({
          type: 'change_tactics',
          description: 'Change approach to break out of action loop',
          confidence: 0.9,
          actions: [
            { type: 'scroll', params: { direction: 'down', amount: 300 } },
            { type: 'read_ui', params: {} }
          ]
        });
      }
      
      if (commonReasons.includes('page_load_timeout')) {
        strategies.push({
          type: 'wait_and_retry',
          description: 'Wait longer and retry the action',
          confidence: 0.7,
          actions: [
            { type: 'wait', params: { seconds: 5 } },
            { type: 'read_ui', params: {} }
          ]
        });
      }
    }
    
    // Get success patterns for this action
    if (successPatterns.length > 0) {
      const recentSuccesses = successPatterns.slice(-5);
      const successfulActions = recentSuccesses.map(p => p.action);
      
      // Use successful actions as recovery strategies
      successfulActions.forEach((action, index) => {
        if (index < 3) { // Limit to top 3 successful actions
          strategies.push({
            type: 'retry_successful_action',
            description: `Retry successful action: ${action.type}`,
            confidence: 0.6 + (index * 0.1),
            actions: action.actions || []
          });
        }
      });
    }
    
    // Add generic recovery strategies
    strategies.push({
      type: 'generic_recovery',
      description: 'Apply generic recovery strategy',
      confidence: 0.5,
      actions: [
        { type: 'scroll', params: { direction: 'down', amount: 300 } },
        { type: 'read_ui', params: {} }
      ]
    });
    
    return strategies.sort((a, b) => b.confidence - a.confidence);
  }
};

// Adaptive recovery system
class AdaptiveRecoverySystem {
  constructor() {
    this.recoveryStrategies = [];
    this.adaptationEnabled = true;
    this.maxRecoveryAttempts = 5;
    this.adaptiveLearning = true;
    this.recoveryHistory = [];
    this.recoveryStats = {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      averageRecoveryTime: 0,
      adaptationCount: 0
    };
  }

  // Determine recovery strategy based on action and context
  determineRecovery(action, context, retryCount = 0) {
    // Get recovery strategies from learning system
    const strategies = recoveryLearning.getRecoveryStrategies(action, context);
    
    // Filter strategies based on retry count
    const availableStrategies = strategies.filter(s => {
      if (retryCount === 0) return true; // All strategies available on first attempt
      if (s.type === 'retry_successful_action') return retryCount < 3; // Only retry successful actions up to 3 times
      return true;
    });
    
    // Select best strategy
    const selectedStrategy = availableStrategies[0];
    if (!selectedStrategy) {
      return null; // No recovery strategy available
    }
    
    // Log recovery decision
    console.log(`[ADAPTIVE RECOVERY] Selected strategy: ${selectedStrategy.type} (confidence: ${selectedStrategy.confidence.toFixed(2)}) for action: ${action.type} (retry: ${retryCount})`);
    
    return selectedStrategy;
  }

  // Execute recovery with learning
  async executeRecovery(action, context, retryCount = 0) {
    const startTime = Date.now();
    
    // Determine recovery strategy
    const strategy = this.determineRecovery(action, context, retryCount);
    if (!strategy) {
      console.log(`[ADAPTIVE RECOVERY] No recovery strategy available for action: ${action.type}`);
      return null;
    }
    
    // Execute recovery actions
    console.log(`[ADAPTIVE RECOVERY] Executing recovery: ${strategy.description}`);
    
    try {
      const recoveryTime = Date.now() - startTime;
      
      this.recoveryStats.totalRecoveries++;
      this.recoveryStats.successfulRecoveries++;
      this.recoveryStats.averageRecoveryTime = 
        (this.recoveryStats.averageRecoveryTime * (this.recoveryStats.totalRecoveries - 1) + recoveryTime) / 
        this.recoveryStats.totalRecoveries;
      
      if (this.adaptiveLearning) {
        recoveryLearning.learnFromSuccess(action, context, {
          success: true,
          recoveryTime: recoveryTime,
          strategy: strategy.type
        });
      }
      
      console.log(`[ADAPTIVE RECOVERY] Returning recovery plan: ${strategy.description}`);
      
      return {
        success: strategy.actions && strategy.actions.length > 0,
        strategy: strategy.type,
        recoveryTime: recoveryTime,
        actions: strategy.actions || []
      };
      
    } catch (error) {
      // Log failed recovery
      console.error(`[ADAPTIVE RECOVERY] Recovery failed: ${error.message}`);
      
      // Learn from failed recovery
      if (this.adaptiveLearning) {
        recoveryLearning.learnFromFailure(action, context, {
          success: false,
          error: error.message,
          strategy: strategy.type
        });
      }
      
      return {
        success: false,
        error: error.message,
        strategy: strategy.type
      };
    }
  }

  // Escalate recovery when normal strategies fail
  async escalateRecovery(action, context, retryCount) {
    console.log(`[ADAPTIVE RECOVERY] Escalating recovery for action: ${action.type} (retry: ${retryCount})`);
    
    const escalationStrategies = [
      {
        type: 'human_intervention',
        description: 'Request human intervention for complex recovery',
        confidence: 0.95,
        actions: []
      },
      {
        type: 'context_reset',
        description: 'Reset context and start over',
        confidence: 0.8,
        actions: [
          { type: 'navigate', params: { url: 'about:blank' } },
          { type: 'read_ui', params: {} }
        ]
      },
      {
        type: 'browser_restart',
        description: 'Restart browser and continue',
        confidence: 0.7,
        actions: []
      }
    ];
    
    const selectedStrategy = escalationStrategies[0];
    
    // Log escalation
    console.log(`[ADAPTIVE RECOVERY] Escalation strategy: ${selectedStrategy.type}`);
    
    return {
      success: false,
      reason: 'recovery_escalated',
      strategy: selectedStrategy.type,
      description: selectedStrategy.description
    };
  }

  // Update recovery statistics
  updateStats(action, success, recoveryTime) {
    this.recoveryStats.totalRecoveries++;
    if (success) {
      this.recoveryStats.successfulRecoveries++;
    }
    
    this.recoveryStats.averageRecoveryTime = 
      (this.recoveryStats.averageRecoveryTime * (this.recoveryStats.totalRecoveries - 1) + recoveryTime) / 
      this.recoveryStats.totalRecoveries;
    
    this.recoveryStats.adaptationCount++;
  }

  // Get recovery statistics
  getRecoveryStats() {
    const successRate = this.recoveryStats.totalRecoveries > 0 
      ? (this.recoveryStats.successfulRecoveries / this.recoveryStats.totalRecoveries) * 100 
      : 0;
    
    return {
      totalRecoveries: this.recoveryStats.totalRecoveries,
      successfulRecoveries: this.recoveryStats.successfulRecoveries,
      successRate: successRate,
      averageRecoveryTime: this.recoveryStats.averageRecoveryTime,
      adaptationCount: this.recoveryStats.adaptationCount,
      learningEnabled: this.adaptiveLearning
    };
  }

  // Enable or disable adaptive learning
  setAdaptiveLearning(enabled) {
    this.adaptiveLearning = enabled;
    recoveryLearning.learningEnabled = enabled;
    console.log(`[ADAPTIVE RECOVERY] Adaptive learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Add custom recovery strategy
  addRecoveryStrategy(strategy) {
    this.recoveryStrategies.push(strategy);
    console.log(`[ADAPTIVE RECOVERY] Added custom recovery strategy: ${strategy.type}`);
  }
}

// Global adaptive recovery system instance
const adaptiveRecovery = new AdaptiveRecoverySystem();

// Export recovery system
export { AdaptiveRecoverySystem, adaptiveRecovery };
export default adaptiveRecovery;

// Export convenience functions
export async function executeAdaptiveRecovery(action, context, retryCount = 0) {
  return adaptiveRecovery.executeRecovery(action, context, retryCount);
}

export function escalateRecovery(action, context, retryCount) {
  return adaptiveRecovery.escalateRecovery(action, context, retryCount);
}

export function getRecoveryStats() {
  return adaptiveRecovery.getRecoveryStats();
}

export function setAdaptiveLearning(enabled) {
  adaptiveRecovery.setAdaptiveLearning(enabled);
}

console.log('[ADAPTIVE RECOVERY] Adaptive recovery system initialized with learning capabilities');