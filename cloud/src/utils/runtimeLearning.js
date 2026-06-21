// Runtime Learning System from Interactions
// Learns from user interactions and improves system performance over time

const fs = require('fs');
const path = require('path');

// Runtime learning statistics
const learningStats = {
  interactionHistory: [],
  successPatterns: new Map(),
  failurePatterns: new Map(),
  adaptationHistory: [],
  learningEnabled: true,
  maxHistorySize: 1000,
  confidenceThreshold: 0.7,
  adaptationRate: 0.1,
  
  // Track user interactions
  trackInteraction(interaction) {
    const enrichedInteraction = {
      ...interaction,
      timestamp: Date.now(),
      sessionId: interaction.sessionId || `session_${Date.now()}`,
      userId: interaction.userId || 'anonymous',
      context: {
        pageUrl: interaction.pageUrl || '',
        pageTitle: interaction.pageTitle || '',
        userAgent: interaction.userAgent || '',
        viewport: interaction.viewport || { width: 1920, height: 1080 }
      }
    };
    
    this.interactionHistory.push(enrichedInteraction);
    
    // Keep only recent history
    if (this.interactionHistory.length > this.maxHistorySize) {
      this.interactionHistory.splice(0, this.interactionHistory.length - this.maxHistorySize);
    }
    
    // Learn from interaction
    this.learnFromInteraction(enrichedInteraction);
    
    console.log(`[RUNTIME LEARNING] Tracked interaction: ${interaction.type} - ${interaction.action}`);
  },
  
  // Learn from user interaction
  learnFromInteraction(interaction) {
    const patternKey = `${interaction.action}:${interaction.pageUrl}`;
    
    if (interaction.success) {
      if (!this.successPatterns.has(patternKey)) {
        this.successPatterns.set(patternKey, []);
      }
      this.successPatterns.get(patternKey).push(interaction);
    } else {
      if (!this.failurePatterns.has(patternKey)) {
        this.failurePatterns.set(patternKey, []);
      }
      this.failurePatterns.get(patternKey).push(interaction);
    }
    
    // Analyze patterns
    this.analyzeInteractionPatterns();
  },
  
  // Analyze interaction patterns
  analyzeInteractionPatterns() {
    const currentTime = Date.now();
    const recentInteractions = this.interactionHistory.filter(
      i => currentTime - i.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );
    
    // Analyze success patterns
    const successRates = {};
    for (const [patternKey, interactions] of this.successPatterns) {
      const recentSuccesses = interactions.filter(i => 
        currentTime - i.timestamp < 24 * 60 * 60 * 1000
      );
      const successRate = recentSuccesses.length / Math.max(interactions.length, 1);
      successRates[patternKey] = successRate;
    }
    
    // Identify high-success patterns
    const highSuccessPatterns = Object.entries(successRates)
      .filter(([_, rate]) => rate > this.confidenceThreshold)
      .map(([pattern]) => pattern);
    
    // Adapt system based on high-success patterns
    if (highSuccessPatterns.length > 0) {
      this.adaptFromHighSuccessPatterns(highSuccessPatterns);
    }
    
    // Analyze failure patterns
    const failureRates = {};
    for (const [patternKey, interactions] of this.failurePatterns) {
      const recentFailures = interactions.filter(i => 
        currentTime - i.timestamp < 24 * 60 * 60 * 1000
      );
      const failureRate = recentFailures.length / Math.max(interactions.length, 1);
      failureRates[patternKey] = failureRate;
    }
    
    // Identify high-failure patterns
    const highFailurePatterns = Object.entries(failureRates)
      .filter(([_, rate]) => rate > 0.5)
      .map(([pattern]) => pattern);
    
    // Adapt system based on high-failure patterns
    if (highFailurePatterns.length > 0) {
      this.adaptFromHighFailurePatterns(highFailurePatterns);
    }
  },
  
  // Adapt from high-success patterns
  adaptFromHighSuccessPatterns(patterns) {
    console.log(`[RUNTIME LEARNING] Adapting from ${patterns.length} high-success patterns`);
    
    patterns.forEach(pattern => {
      const interactions = this.successPatterns.get(pattern) || [];
      const recentInteractions = interactions.filter(i => 
        Date.now() - i.timestamp < 24 * 60 * 60 * 1000
      );
      
      if (recentInteractions.length > 0) {
        const avgAction = this.getMostCommonAction(recentInteractions);
        const avgPage = this.getMostCommonPage(recentInteractions);
        
        console.log(`[RUNTIME LEARNING] Pattern ${pattern}: avg action=${avgAction}, avg page=${avgPage}`);
        
        // Store adaptation
        this.adaptationHistory.push({
          type: 'success_adaptation',
          pattern: pattern,
          action: avgAction,
          page: avgPage,
          timestamp: Date.now()
        });
      }
    });
  },
  
  // Adapt from high-failure patterns
  adaptFromHighFailurePatterns(patterns) {
    console.log(`[RUNTIME LEARNING] Adapting from ${patterns.length} high-failure patterns`);
    
    patterns.forEach(pattern => {
      const interactions = this.failurePatterns.get(pattern) || [];
      const recentInteractions = interactions.filter(i => 
        Date.now() - i.timestamp < 24 * 60 * 60 * 1000
      );
      
      if (recentInteractions.length > 0) {
        const commonErrors = this.getMostCommonErrors(recentInteractions);
        const commonActions = this.getMostCommonAction(recentInteractions);
        
        console.log(`[RUNTIME LEARNING] Pattern ${pattern}: common errors=${commonErrors}, common actions=${commonActions}`);
        
        // Store adaptation
        this.adaptationHistory.push({
          type: 'failure_adaptation',
          pattern: pattern,
          errors: commonErrors,
          actions: commonActions,
          timestamp: Date.now()
        });
      }
    });
  },
  
  // Get most common action from interactions
  getMostCommonAction(interactions) {
    const actionCounts = {};
    interactions.forEach(i => {
      actionCounts[i.action] = (actionCounts[i.action] || 0) + 1;
    });
    
    return Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  },
  
  // Get most common page from interactions
  getMostCommonPage(interactions) {
    const pageCounts = {};
    interactions.forEach(i => {
      pageCounts[i.pageUrl] = (pageCounts[i.pageUrl] || 0) + 1;
    });
    
    return Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  },
  
  // Get most common errors from interactions
  getMostCommonErrors(interactions) {
    const errorCounts = {};
    interactions.forEach(i => {
      if (i.error) {
        errorCounts[i.error] = (errorCounts[i.error] || 0) + 1;
      }
    });
    
    return Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([error]) => error);
  },
  
  // Get learning recommendations
  getLearningRecommendations() {
    const recommendations = [];
    const currentTime = Date.now();
    const recentInteractions = this.interactionHistory.filter(
      i => currentTime - i.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    );
    
    // Analyze recent trends
    const recentSuccessRates = {};
    for (const [patternKey, interactions] of this.successPatterns) {
      const recentSuccesses = interactions.filter(i => 
        currentTime - i.timestamp < 7 * 24 * 60 * 60 * 1000
      );
      const successRate = recentSuccesses.length / Math.max(interactions.length, 1);
      recentSuccessRates[patternKey] = successRate;
    }
    
    // Generate recommendations
    Object.entries(recentSuccessRates).forEach(([pattern, rate]) => {
      if (rate > 0.8) {
        recommendations.push({
          type: 'optimize',
          pattern: pattern,
          reason: `High success rate (${(rate * 100).toFixed(1)}%) - optimize this pattern`,
          priority: 'high'
        });
      } else if (rate < 0.3) {
        recommendations.push({
          type: 'investigate',
          pattern: pattern,
          reason: `Low success rate (${(rate * 100).toFixed(1)}%) - investigate this pattern`,
          priority: 'medium'
        });
      }
    });
    
    // Add adaptation recommendations
    const recentAdaptations = this.adaptationHistory.filter(
      a => currentTime - a.timestamp < 7 * 24 * 60 * 60 * 1000
    );
    
    if (recentAdaptations.length > 0) {
      recommendations.push({
        type: 'continue_adaptation',
        reason: `Recent adaptations (${recentAdaptations.length}) - continue learning and adapting`,
        priority: 'low'
      });
    }
    
    return recommendations;
  },
  
  // Get learning statistics
  getLearningStats() {
    const currentTime = Date.now();
    const recentInteractions = this.interactionHistory.filter(
      i => currentTime - i.timestamp < 24 * 60 * 60 * 1000
    );
    
    const successRate = recentInteractions.length > 0
      ? recentInteractions.filter(i => i.success).length / recentInteractions.length
      : 0;
    
    return {
      totalInteractions: this.interactionHistory.length,
      recentInteractions: recentInteractions.length,
      successRate: successRate,
      successPatterns: this.successPatterns.size,
      failurePatterns: this.failurePatterns.size,
      adaptationCount: this.adaptationHistory.length,
      learningEnabled: this.learningEnabled,
      confidenceThreshold: this.confidenceThreshold,
      adaptationRate: this.adaptationRate
    };
  }
};

// Runtime learning system
class RuntimeLearningSystem {
  constructor() {
    this.learningStats = learningStats;
    this.adaptationEnabled = true;
    this.autoAdaptationEnabled = true;
    this.userProfile = {
      preferences: {},
      behavior: {},
      history: []
    };
    this.globalAdaptations = [];
  }

  // Track user interaction
  trackInteraction(interaction) {
    this.learningStats.trackInteraction(interaction);
    this.updateUserProfile(interaction);
    this.checkForAutoAdaptation(interaction);
  }

  // Update user profile
  updateUserProfile(interaction) {
    // Update behavior patterns
    if (!this.userProfile.behavior[interaction.action]) {
      this.userProfile.behavior[interaction.action] = {
        count: 0,
        successRate: 0,
        lastUsed: Date.now()
      };
    }
    
    const behavior = this.userProfile.behavior[interaction.action];
    behavior.count++;
    behavior.successRate = (behavior.successRate * (behavior.count - 1) + (interaction.success ? 1 : 0)) / behavior.count;
    behavior.lastUsed = Date.now();
    
    // Update preferences
    if (interaction.success) {
      if (!this.userProfile.preferences[interaction.action]) {
        this.userProfile.preferences[interaction.action] = 0;
      }
      this.userProfile.preferences[interaction.action]++;
    }
    
    this.userProfile.history.push({
      ...interaction,
      timestamp: Date.now()
    });
    
    // Keep history manageable
    if (this.userProfile.history.length > 1000) {
      this.userProfile.history.splice(0, this.userProfile.history.length - 1000);
    }
  }

  // Check for auto-adaptation
  checkForAutoAdaptation(interaction) {
    if (!this.autoAdaptationEnabled) return;
    
    const patternKey = `${interaction.action}:${interaction.pageUrl}`;
    const recentInteractions = this.learningStats.interactionHistory.filter(
      i => i.timestamp > Date.now() - 24 * 60 * 60 * 1000
    );
    
    const patternInteractions = recentInteractions.filter(i => i.action === interaction.action);
    const successRate = patternInteractions.length > 0
      ? patternInteractions.filter(i => i.success).length / patternInteractions.length
      : 0;
    
    // Adapt if success rate is too low
    if (successRate < 0.3 && patternInteractions.length >= 5) {
      console.log(`[RUNTIME LEARNING] Auto-adapting due to low success rate (${(successRate * 100).toFixed(1)}%) for pattern: ${patternKey}`);
      this.adaptForPattern(patternKey, interaction);
    }
    
    // Adapt if success rate is very high
    if (successRate > 0.9 && patternInteractions.length >= 5) {
      console.log(`[RUNTIME LEARNING] Auto-optimizing due to high success rate (${(successRate * 100).toFixed(1)}%) for pattern: ${patternKey}`);
      this.optimizeForPattern(patternKey, interaction);
    }
  }

  // Adapt for a specific pattern
  adaptForPattern(patternKey, interaction) {
    const adaptations = [];
    
    // Find common errors for this pattern
    const errors = this.learningStats.failurePatterns.get(patternKey) || [];
    const commonErrors = errors.length > 0
      ? errors.slice(-5).map(e => e.error || 'unknown').filter(e => e)
      : ['unknown'];
    
    // Find successful actions for this pattern
    const successes = this.learningStats.successPatterns.get(patternKey) || [];
    const successfulActions = successes.length > 0
      ? successes.slice(-5).map(s => s.action || 'unknown').filter(a => a)
      : ['unknown'];
    
    // Create adaptation suggestions
    adaptations.push({
      type: 'error_handling',
      description: `Improve error handling for pattern: ${patternKey}`, 
      errors: commonErrors,
      priority: 'high'
    });
    
    adaptations.push({
      type: 'action_optimization',
      description: `Optimize actions for pattern: ${patternKey}`,
      successfulActions: successfulActions,
      priority: 'medium'
    });
    
    this.globalAdaptations.push(...adaptations);
    console.log(`[RUNTIME LEARNING] Created ${adaptations.length} adaptations for pattern: ${patternKey}`);
  }

  // Optimize for a specific pattern
  optimizeForPattern(patternKey, interaction) {
    const optimizations = [];
    
    // Find successful actions for this pattern
    const successes = this.learningStats.successPatterns.get(patternKey) || [];
    const successfulActions = successes.length > 0
      ? successes.slice(-5).map(s => s.action || 'unknown').filter(a => a)
      : ['unknown'];
    
    // Create optimization suggestions
    optimizations.push({
      type: 'action_prioritization',
      description: `Prioritize successful actions for pattern: ${patternKey}`,
      successfulActions: successfulActions,
      priority: 'high'
    });
    
    optimizations.push({
      type: 'pattern_reinforcement',
      description: `Reinforce successful patterns for: ${patternKey}`,
      successfulActions: successfulActions,
      priority: 'medium'
    });
    
    this.globalAdaptations.push(...optimizations);
    console.log(`[RUNTIME LEARNING] Created ${optimizations.length} optimizations for pattern: ${patternKey}`);
  }

  // Get learning recommendations
  getLearningRecommendations() {
    const statsRecommendations = this.learningStats.getLearningRecommendations();
    const userRecommendations = this.getUserRecommendations();
    
    return {
      stats: statsRecommendations,
      user: userRecommendations,
      global: this.globalAdaptations.slice(-10),
      timestamp: Date.now()
    };
  }

  // Get user recommendations
  getUserRecommendations() {
    const recommendations = [];
    
    // Recommend actions based on user preferences
    Object.entries(this.userProfile.preferences).forEach(([action, count]) => {
      if (count > 5) { // User has used this action frequently
        recommendations.push({
          type: 'preference_based',
          action: action,
          reason: `You frequently use ${action} (${count} times) - consider optimizing this action`,
          priority: 'medium'
        });
      }
    });
    
    // Recommend based on user behavior patterns
    const behaviorEntries = Object.entries(this.userProfile.behavior);
    const highSuccessActions = behaviorEntries
      .filter(([_, behavior]) => behavior.successRate > 0.8 && behavior.count >= 3)
      .map(([action]) => action);
    
    if (highSuccessActions.length > 0) {
      recommendations.push({
        type: 'behavior_based',
        actions: highSuccessActions,
        reason: `You have high success rates with these actions - consider prioritizing them`,
        priority: 'high'
      });
    }
    
    return recommendations;
  }

  // Enable or disable learning
  setLearningEnabled(enabled) {
    this.adaptationEnabled = enabled;
    this.learningStats.learningEnabled = enabled;
    console.log(`[RUNTIME LEARNING] Learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Enable or disable auto-adaptation
  setAutoAdaptationEnabled(enabled) {
    this.autoAdaptationEnabled = enabled;
    console.log(`[RUNTIME LEARNING] Auto-adaptation ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Get learning statistics
  getLearningStats() {
    return {
      stats: this.learningStats.getLearningStats(),
      userProfile: {
        preferences: this.userProfile.preferences,
        behavior: this.userProfile.behavior,
        historyCount: this.userProfile.history.length
      },
      globalAdaptations: this.globalAdaptations.length,
      adaptationEnabled: this.adaptationEnabled,
      autoAdaptationEnabled: this.autoAdaptationEnabled
    };
  }
}

// Global runtime learning system instance
const runtimeLearning = new RuntimeLearningSystem();

// Export runtime learning system
export { RuntimeLearningSystem, runtimeLearning, learningStats };
export default runtimeLearning;

// Export convenience functions
export function trackInteraction(interaction) {
  runtimeLearning.trackInteraction(interaction);
}

export function getLearningRecommendations() {
  return runtimeLearning.getLearningRecommendations();
}

export function setLearningEnabled(enabled) {
  runtimeLearning.setLearningEnabled(enabled);
}

export function setAutoAdaptationEnabled(enabled) {
  runtimeLearning.setAutoAdaptationEnabled(enabled);
}

export function getLearningStats() {
  return runtimeLearning.getLearningStats();
}

console.log('[RUNTIME LEARNING] Runtime learning system initialized');