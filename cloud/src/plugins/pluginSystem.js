// Plugin Architecture for Extensible Capabilities
// Replaces hardcoded capabilities with dynamic plugin system

const fs = require('fs');
const path = require('path');

// Plugin system registry
const pluginRegistry = {
  plugins: new Map(),
  capabilities: new Map(),
  actions: new Map(),
  hooks: new Map(),
  loadedPlugins: [],
  pluginConfig: {
    autoLoad: true,
    validatePlugins: true,
    enableHotReload: false,
    maxPlugins: 50
  }
};

// Plugin base class
class Plugin {
  constructor(name, version, description) {
    this.name = name;
    this.version = version;
    this.description = description;
    this.id = `${name}@${version}`;
    this.enabled = true;
    this.dependencies = [];
    this.hooks = {};
    this.capabilities = {};
    this.actions = {};
    this.metadata = {
      author: 'Unknown',
      license: 'MIT',
      website: '',
      tags: [],
      created: Date.now(),
      lastUpdated: Date.now()
    };
  }

  // Register a capability
  registerCapability(name, capability) {
    this.capabilities[name] = capability;
    pluginRegistry.capabilities.set(`${this.id}:${name}`, capability);
    console.log(`[PLUGIN] Registered capability: ${this.id}:${name}`);
  }

  // Register an action
  registerAction(name, action) {
    this.actions[name] = action;
    pluginRegistry.actions.set(`${this.id}:${name}`, action);
    console.log(`[PLUGIN] Registered action: ${this.id}:${name}`);
  }

  // Register a hook
  registerHook(event, handler) {
    if (!this.hooks[event]) {
      this.hooks[event] = [];
    }
    this.hooks[event].push(handler);
    pluginRegistry.hooks.set(`${this.id}:${event}`, handler);
    console.log(`[PLUGIN] Registered hook: ${this.id}:${event}`);
  }

  // Execute hooks
  executeHooks(event, data) {
    const results = [];
    const hooks = this.hooks[event] || [];
    
    for (const hook of hooks) {
      try {
        const result = hook(data);
        if (result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[PLUGIN] Hook execution failed: ${this.id}:${event}`, error.message);
      }
    }
    
    return results;
  }

  // Get capability
  getCapability(name) {
    return this.capabilities[name];
  }

  // Get action
  getAction(name) {
    return this.actions[name];
  }

  // Check if plugin is enabled
  isEnabled() {
    return this.enabled;
  }

  // Enable plugin
  enable() {
    this.enabled = true;
    console.log(`[PLUGIN] Plugin enabled: ${this.id}`);
  }

  // Disable plugin
  disable() {
    this.enabled = false;
    console.log(`[PLUGIN] Plugin disabled: ${this.id}`);
  }

  // Update plugin
  update(updateFunction) {
    try {
      updateFunction(this);
      this.metadata.lastUpdated = Date.now();
      console.log(`[PLUGIN] Plugin updated: ${this.id}`);
    } catch (error) {
      console.error(`[PLUGIN] Plugin update failed: ${this.id}`, error.message);
    }
  }

  // Get plugin info
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      enabled: this.enabled,
      dependencies: this.dependencies,
      capabilities: Object.keys(this.capabilities),
      actions: Object.keys(this.actions),
      hooks: Object.keys(this.hooks),
      metadata: this.metadata
    };
  }
}

// Plugin loader
class PluginLoader {
  constructor() {
    this.pluginDir = path.join(__dirname, '..', '..', 'plugins');
    this.pluginCache = new Map();
    this.loadingQueue = [];
    this.loadedPlugins = [];
  }

  // Load plugin from file
  async loadPlugin(pluginPath) {
    try {
      const pluginModule = require(pluginPath);
      const plugin = new Plugin(
        pluginModule.name || 'Unnamed Plugin',
        pluginModule.version || '1.0.0',
        pluginModule.description || 'No description'
      );

      // Set metadata if provided
      if (pluginModule.metadata) {
        Object.assign(plugin.metadata, pluginModule.metadata);
      }

      // Set dependencies
      if (pluginModule.dependencies) {
        plugin.dependencies = pluginModule.dependencies;
      }

      // Register capabilities
      if (pluginModule.capabilities) {
        Object.entries(pluginModule.capabilities).forEach(([name, capability]) => {
          plugin.registerCapability(name, capability);
        });
      }

      // Register actions
      if (pluginModule.actions) {
        Object.entries(pluginModule.actions).forEach(([name, action]) => {
          plugin.registerAction(name, action);
        });
      }

      // Register hooks
      if (pluginModule.hooks) {
        Object.entries(pluginModule.hooks).forEach(([event, handler]) => {
          plugin.registerHook(event, handler);
        });
      }

      // Add to registry
      pluginRegistry.plugins.set(plugin.id, plugin);
      this.loadedPlugins.push(plugin);

      console.log(`[PLUGIN LOADER] Loaded plugin: ${plugin.id}`);
      return plugin;

    } catch (error) {
      console.error(`[PLUGIN LOADER] Failed to load plugin: ${pluginPath}`, error.message);
      throw error;
    }
  }

  // Load all plugins
  async loadAllPlugins() {
    if (!fs.existsSync(this.pluginDir)) {
      console.log(`[PLUGIN LOADER] Plugin directory not found: ${this.pluginDir}`);
      return;
    }

    const pluginFiles = fs.readdirSync(this.pluginDir)
      .filter(file => file.endsWith('.js') || file.endsWith('.json'))
      .filter(file => !file.startsWith('.'));

    console.log(`[PLUGIN LOADER] Found ${pluginFiles.length} plugin files`);

    for (const pluginFile of pluginFiles) {
      const pluginPath = path.join(this.pluginDir, pluginFile);
      try {
        await this.loadPlugin(pluginPath);
      } catch (error) {
        console.error(`[PLUGIN LOADER] Failed to load plugin: ${pluginFile}`, error.message);
      }
    }

    console.log(`[PLUGIN LOADER] Loaded ${this.loadedPlugins.length} plugins`);
  }

  // Get plugin by ID
  getPlugin(pluginId) {
    return pluginRegistry.plugins.get(pluginId);
  }

  // Get all plugins
  getAllPlugins() {
    return Array.from(pluginRegistry.plugins.values());
  }

  // Get enabled plugins
  getEnabledPlugins() {
    return this.getAllPlugins().filter(plugin => plugin.isEnabled());
  }

  // Get capabilities from all plugins
  getAllCapabilities() {
    const capabilities = {};
    this.getEnabledPlugins().forEach(plugin => {
      Object.entries(plugin.capabilities).forEach(([name, capability]) => {
        capabilities[`${plugin.name}:${name}`] = capability;
      });
    });
    return capabilities;
  }

  // Get actions from all plugins
  getAllActions() {
    const actions = {};
    this.getEnabledPlugins().forEach(plugin => {
      Object.entries(plugin.actions).forEach(([name, action]) => {
        actions[`${plugin.name}:${name}`] = action;
      });
    });
    return actions;
  }

  // Get hooks from all plugins
  getAllHooks() {
    const hooks = {};
    this.getEnabledPlugins().forEach(plugin => {
      Object.entries(plugin.hooks).forEach(([event, handlers]) => {
        if (!hooks[event]) {
          hooks[event] = [];
        }
        hooks[event].push(...handlers);
      });
    });
    return hooks;
  }

  // Execute all hooks for an event
  async executeAllHooks(event, data) {
    const hooks = this.getAllHooks()[event] || [];
    const results = [];

    for (const hook of hooks) {
      try {
        const result = await hook(data);
        if (result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[PLUGIN LOADER] Hook execution failed: ${event}`, error.message);
      }
    }

    return results;
  }

  // Enable plugin by ID
  enablePlugin(pluginId) {
    const plugin = this.getPlugin(pluginId);
    if (plugin) {
      plugin.enable();
      return true;
    }
    return false;
  }

  // Disable plugin by ID
  disablePlugin(pluginId) {
    const plugin = this.getPlugin(pluginId);
    if (plugin) {
      plugin.disable();
      return true;
    }
    return false;
  }

  // Update plugin
  async updatePlugin(pluginId, updateFunction) {
    const plugin = this.getPlugin(pluginId);
    if (plugin) {
      plugin.update(updateFunction);
      return true;
    }
    return false;
  }

  // Remove plugin
  removePlugin(pluginId) {
    const plugin = this.getPlugin(pluginId);
    if (plugin) {
      pluginRegistry.plugins.delete(pluginId);
      const index = this.loadedPlugins.indexOf(plugin);
      if (index > -1) {
        this.loadedPlugins.splice(index, 1);
      }
      console.log(`[PLUGIN LOADER] Removed plugin: ${pluginId}`);
      return true;
    }
    return false;
  }

  // Get plugin statistics
  getPluginStats() {
    const plugins = this.getAllPlugins();
    const enabledPlugins = this.getEnabledPlugins();
    
    return {
      totalPlugins: plugins.length,
      enabledPlugins: enabledPlugins.length,
      capabilities: Object.keys(this.getAllCapabilities()).length,
      actions: Object.keys(this.getAllActions()).length,
      hooks: Object.keys(this.getAllHooks()).length,
      pluginDetails: plugins.map(p => p.getInfo())
    };
  }
}

// Global plugin loader instance
const pluginLoader = new PluginLoader();

// Initialize plugin system
async function initializePluginSystem() {
  console.log('[PLUGIN SYSTEM] Initializing plugin system...');
  await pluginLoader.loadAllPlugins();
  console.log('[PLUGIN SYSTEM] Plugin system initialized');
}

// Export plugin system
export { Plugin, PluginLoader, pluginRegistry, pluginLoader, initializePluginSystem };
export default pluginLoader;

// Export convenience functions
export async function loadPlugin(pluginPath) {
  return pluginLoader.loadPlugin(pluginPath);
}

export function getPlugin(pluginId) {
  return pluginLoader.getPlugin(pluginId);
}

export function getAllPlugins() {
  return pluginLoader.getAllPlugins();
}

export function getEnabledPlugins() {
  return pluginLoader.getEnabledPlugins();
}

export function getAllCapabilities() {
  return pluginLoader.getAllCapabilities();
}

export function getAllActions() {
  return pluginLoader.getAllActions();
}

export function getAllHooks() {
  return pluginLoader.getAllHooks();
}

export async function executeAllHooks(event, data) {
  return pluginLoader.executeAllHooks(event, data);
}

export function enablePlugin(pluginId) {
  return pluginLoader.enablePlugin(pluginId);
}

export function disablePlugin(pluginId) {
  return pluginLoader.disablePlugin(pluginId);
}

export async function updatePlugin(pluginId, updateFunction) {
  return pluginLoader.updatePlugin(pluginId, updateFunction);
}

export function removePlugin(pluginId) {
  return pluginLoader.removePlugin(pluginId);
}

export function getPluginStats() {
  return pluginLoader.getPluginStats();
}

// Auto-initialize if not in test environment
if (process.env.NODE_ENV !== 'test') {
  initializePluginSystem();
}