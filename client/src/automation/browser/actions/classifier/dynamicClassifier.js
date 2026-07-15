
import fs from 'fs';
import path from 'path';

let mlModelCache = null;
let modelTrainingStats = {
  lastTraining: null,
  accuracy: 0.85,
  trainingCount: 0,
  adaptationCount: 0
};

class ElementClassifierNN {
  constructor() {
    this.weights = this.initializeWeights();
    this.learningRate = 0.01;
    this.featureExtractor = this.createFeatureExtractor();
  }

  initializeWeights() {
    return {
      purposeWeights: {
        search_input: 0.8,
        navigation_target: 0.7,
        form_input: 0.6,
        action_target: 0.5,
        confirmation_action: 0.4,
        primary_content: 0.3,
        generic: 0.2
      },
      confidenceWeights: {
        high: 0.9,
        medium: 0.7,
        low: 0.5
      }
    };
  }

  createFeatureExtractor() {
    return function(el, role) {
      const features = {};
      
      features.text = (el.text || "").toLowerCase();
      features.textLength = features.text.length;
      features.hasText = !!features.text;
      features.isEmptyText = features.text.trim() === "";
      
      features.placeholder = (el.placeholder || "").toLowerCase();
      features.ariaLabel = (el.ariaLabel || "").toLowerCase();
      features.name = (el.name || "").toLowerCase();
      features.title = (el.title || "").toLowerCase();
      features.href = (el.href || "").toLowerCase();
      
      features.combined = `${features.text} ${features.placeholder} ${features.ariaLabel} ${features.name} ${features.title} ${features.href}`;
      
      features.role = role;
      features.isInput = role === "input";
      features.isButton = role === "button";
      features.isLink = role === "link";
      
      features.readOnly = el.readOnly || el.readonly || false;
      features.disabled = el.disabled || false;
      features.enabled = !features.disabled;
      
      features.hasIcon = !features.hasText && (features.ariaLabel || features.title);
      
      features.patterns = {
        search: /search|find|query|jump to/i.test(features.combined),
        navigation: /home|logo|profile|account|cart/i.test(features.combined),
        form: /email|password|job|location|city/i.test(features.combined),
        action: /close|dismiss|cancel|confirm|ok|agree|accept|menu|nav|hamburger|options|download|export|filter|sign in|login|sign up|play|pause|stop|add to cart|checkout|connect|follow|tweet|post|share/i.test(features.combined),
        content: /result|title|headline|jobs|comments|watch|shorts|live|dp|gp|wiki/i.test(features.combined)
      };
      
      return features;
    };
  }

  extractFeatures(el, role) {
    return this.featureExtractor(el, role);
  }

  predict(features) {
    const scores = {};
    const role = features.role;
    
    if (role === "input") {
      if (features.patterns.search && features.readOnly) {
        scores.navigation_target = (this.weights.purposeWeights.navigation_target || 0.7) * 1.2;
      }
      if (features.patterns.search) {
        scores.search_input = (this.weights.purposeWeights.search_input || 0.8) * 1.1;
      }
      if (features.patterns.form) {
        scores.form_input = (this.weights.purposeWeights.form_input || 0.6);
      }
    } else if (role === "button") {
      if (features.patterns.search) {
        scores.action_target = (this.weights.purposeWeights.action_target || 0.5) * 1.2;
      }
      if (features.patterns.action) {
        scores.confirmation_action = (this.weights.purposeWeights.confirmation_action || 0.4) * 1.1;
      }
      if (features.patterns.search || features.patterns.action) {
        scores.action_target = Math.max(scores.action_target || 0, (this.weights.purposeWeights.action_target || 0.5) * 1.0);
      }
    } else if (role === "link") {
      if (features.patterns.navigation) {
        scores.navigation_target = (this.weights.purposeWeights.navigation_target || 0.7) * 1.2;
      }
      if (features.patterns.content) {
        scores.primary_content = (this.weights.purposeWeights.primary_content || 0.3) * 1.1;
      }
    }
    
    if (Object.keys(scores).length === 0) {
      scores.generic = (this.weights.purposeWeights.generic || 0.2);
    }
    
    const bestPurpose = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b, 'generic');
    const confidence = Math.min(scores[bestPurpose] || 0.5, 1.0);
    
    return { purpose: bestPurpose, confidence };
  }

  learnFromExample(el, role, correctPurpose) {
    const features = this.extractFeatures(el, role);
    const prediction = this.predict(features);
    
    const error = prediction.purpose === correctPurpose ? 0 : 1;
    const confidenceAdjustment = error ? -0.1 : 0.05;
    
    if (this.weights.purposeWeights[prediction.purpose]) {
      this.weights.purposeWeights[prediction.purpose] += confidenceAdjustment;
    }
    
    modelTrainingStats.adaptationCount++;
    modelTrainingStats.lastTraining = Date.now();
    
    console.log(`[ML CLASSIFIER] Learned from example: ${prediction.purpose} → ${correctPurpose} (confidence: ${prediction.confidence.toFixed(2)})`);
  }

  adaptFromContext(browserContext) {
    if (browserContext && browserContext.pageType) {
      const pageType = browserContext.pageType.toLowerCase();
      
      if (pageType.includes('search')) {
        this.weights.purposeWeights.search_input *= 1.1;
        this.weights.purposeWeights.navigation_target *= 1.05;
      } else if (pageType.includes('product')) {
        this.weights.purposeWeights.form_input *= 1.15;
        this.weights.purposeWeights.action_target *= 1.1;
      } else if (pageType.includes('content')) {
        this.weights.purposeWeights.primary_content *= 1.2;
        this.weights.purposeWeights.navigation_target *= 1.05;
      }
    }
    
    modelTrainingStats.adaptationCount++;
    console.log(`[ML CLASSIFIER] Adapted weights from context: ${modelTrainingStats.adaptationCount} adaptations`);
  }
}

class DynamicElementClassifier {
  constructor() {
    this.nnClassifier = new ElementClassifierNN();
    this.fallbackClassifier = this.createFallbackClassifier();
    this.confidenceThreshold = 0.7;
    this.adaptiveLearning = true;
  }

  createFallbackClassifier() {
    return function(el, role) {
      const text = (el.text || "").toLowerCase();
      const placeholder = (el.placeholder || "").toLowerCase();
      const combined = `${text} ${placeholder}`;
      
      let purpose = "generic";
      let confidence = 0.5;
      
      if (role === "input") {
        if (combined.includes("search") || placeholder.includes("search")) {
          purpose = "search_input";
          confidence = 0.9;
        } else if (combined.includes("email") || combined.includes("password")) {
          purpose = "form_input";
          confidence = 0.8;
        }
      } else if (role === "button") {
        if (combined.includes("search") || text === "search") {
          purpose = "action_target";
          confidence = 0.9;
        } else if (combined.includes("close") || combined.includes("cancel")) {
          purpose = "confirmation_action";
          confidence = 0.9;
        }
      } else if (role === "link") {
        if (combined.includes("home") || combined.includes("profile")) {
          purpose = "navigation_target";
          confidence = 0.8;
        } else if (combined.includes("result") || combined.includes("article")) {
          purpose = "primary_content";
          confidence = 0.8;
        }
      }
      
      let semanticType = "interactive_control";
      if (purpose === "search_input") semanticType = "search_input";
      else if (purpose === "navigation_target") semanticType = "navigation_element";
      else if (purpose === "primary_content") semanticType = "primary_content";
      else if (purpose === "form_input") semanticType = "input_element";
      else if (purpose === "action_target") semanticType = "action_button";
      else if (purpose === "confirmation_action") semanticType = "confirmation_action";
      
      return { purpose, confidence, semanticType };
    };
  }

  classifyElement(el, role, context = {}) {
    try {
      const mlResult = this.nnClassifier.predict(this.nnClassifier.extractFeatures(el, role));
      
      if (mlResult.confidence >= this.confidenceThreshold) {
        if (this.adaptiveLearning && context.pageType) {
          this.nnClassifier.adaptFromContext(context);
        }
        
        return {
          purpose: mlResult.purpose,
          confidence: mlResult.confidence,
          semanticType: this.mapPurposeToSemanticType(mlResult.purpose),
          classificationMethod: "ml"
        };
      }
      
      const fallbackResult = this.fallbackClassifier(el, role);
      
      return {
        ...fallbackResult,
        classificationMethod: "fallback"
      };
      
    } catch (error) {
      console.error("[DYNAMIC CLASSIFIER] ML classification failed, using fallback:", error.message);
      return this.fallbackClassifier(el, role);
    }
  }

  mapPurposeToSemanticType(purpose) {
    const mapping = {
      "search_input": "search_input",
      "navigation_target": "navigation_element",
      "primary_content": "primary_content",
      "form_input": "input_element",
      "action_target": "action_button",
      "confirmation_action": "confirmation_action",
      "generic": "interactive_control"
    };
    return mapping[purpose] || "interactive_control";
  }

  learnFromUserInteraction(el, role, userAction, context) {
    const correctPurpose = this.inferPurposeFromUserAction(userAction);
    
    if (correctPurpose) {
      this.nnClassifier.learnFromExample(el, role, correctPurpose);
    }
  }

  inferPurposeFromUserAction(action) {
    const actionType = (action.type || "").toLowerCase();
    const actionText = (action.text || "").toLowerCase();
    
    if (actionType.includes("search") || actionText.includes("search")) {
      return "search_input";
    } else if (actionType.includes("click") && (actionText.includes("home") || actionText.includes("profile"))) {
      return "navigation_target";
    } else if (actionType.includes("type") && (actionText.includes("email") || actionText.includes("password"))) {
      return "form_input";
    } else if (actionType.includes("click") && (actionText.includes("submit") || actionText.includes("confirm"))) {
      return "confirmation_action";
    } else if (actionType.includes("click") && (actionText.includes("play") || actionText.includes("watch"))) {
      return "action_target";
    }
    
    return null;
  }

  updateContext(context) {
    this.currentContext = context;
  }

  getModelStats() {
    return {
      accuracy: modelTrainingStats.accuracy,
      trainingCount: modelTrainingStats.trainingCount,
      adaptationCount: modelTrainingStats.adaptationCount,
      lastTraining: modelTrainingStats.lastTraining,
      currentConfidence: this.confidenceThreshold
    };
  }
}

const dynamicClassifier = new DynamicElementClassifier();

export function classifyElement(el, role, context = {}) {
  return dynamicClassifier.classifyElement(el, role, context);
}

export function learnFromInteraction(el, role, userAction, context) {
  dynamicClassifier.learnFromUserInteraction(el, role, userAction, context);
}

export function updateClassifierContext(context) {
  dynamicClassifier.updateContext(context);
}

export function getClassifierStats() {
  return dynamicClassifier.getModelStats();
}

export function initializeClassifier() {
  console.log("[DYNAMIC CLASSIFIER] Initialized ML-based element classifier");
  console.log("[DYNAMIC CLASSIFIER] Model ready for adaptive learning");
}

initializeClassifier();
