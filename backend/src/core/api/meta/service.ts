import packageJson from '../../../../package.json';
import { env } from '../../config/env';
import { getWorkspacePluginsConfig } from '../../config/workspacePlugins';
import { getFormEnginePlugins } from '../../integrations/form-engine/FormEngineRegistry';
import { getPluginCatalog } from '../../integrations/plugins/PluginRegistry';
import { isFeatureEnabled, listFeatures } from '../../db/repos/featureRepo';

export const metaApiService = {
  getPlugins() {
    const config = getWorkspacePluginsConfig();
    const plugins = getPluginCatalog();
    const activeFormEngineCode =
      env.getFormEngineDefaultCode() ?? getFormEnginePlugins()[0]?.code ?? 'formio-v5';
    const activeCacheCode = env.getCacheDefaultCode() ?? 'cache-memory';
    const activeMessageBusCode = env.getMessageBusDefaultCode() ?? 'messagebus-memory';
    const activeCodes = new Set([
      activeFormEngineCode,
      activeCacheCode,
      activeMessageBusCode,
      ...config.enabledPlugins,
    ]);
    return {
      enabledPluginCodes: config.enabledPlugins,
      plugins: plugins.map((plugin) => ({
        ...plugin,
        enabled: activeCodes.has(plugin.code),
      })),
    };
  },

  async getFeatures() {
    const features = await listFeatures();
    return {
      features: features.map((f) => ({
        code: f.code,
        name: f.name,
        description: f.description,
        version: f.version,
        status: f.status,
        enabled: isFeatureEnabled(f.status),
      })),
    };
  },

  getBuild() {
    return {
      name: packageJson.name,
      version: packageJson.version,
      nodeVersion: process.version,
      gitSha: env.getOptionalEnv('GIT_SHA') ?? 'unknown',
      gitTag: env.getOptionalEnv('GIT_TAG') ?? 'unknown',
      imageTag: env.getOptionalEnv('IMAGE_TAG') ?? 'unknown',
    };
  },

  async getFormEngines() {
    const plugins = getFormEnginePlugins();
    const defaultCode = env.getFormEngineDefaultCode();
    return {
      items: plugins.map((plugin) => ({
        code: plugin.code,
        name: plugin.name,
        engineVersion: plugin.version ?? null,
        isDefault: plugin.code === (defaultCode ?? plugins[0]?.code ?? null),
      })),
    };
  },
};
