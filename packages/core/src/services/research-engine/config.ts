/**
 * Research Configuration System
 *
 * Loads and manages configuration from research-config.yaml
 * Provides strongly typed access to all configurable settings.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * LLM model configuration for a specific step
 */
export interface ModelConfig {
  model: string;
  temperature: number;
  responseFormat?: "json_object" | "text";
}

/**
 * LLM provider configuration
 */
export interface LLMConfig {
  provider: "openai" | "gemini";
  models: {
    queryGeneration: ModelConfig;
    searchFiltering: ModelConfig;
    relevancyAnalysis: ModelConfig;
    reportCompilation: ModelConfig;
    clusteredReportCompilation: ModelConfig;
    reportSummary: ModelConfig;
  };
  embeddings: {
    model: string;
    dimensions: number;
  };
}

/**
 * Search provider configuration
 */
export interface SearchConfig {
  provider: "brave" | "google" | "bing";
  queriesPerIteration: number;
  resultsPerQuery: number;
  maxUrlsToExtract: number;
  safeSearch: "off" | "moderate" | "strict";
}

/**
 * Content extraction configuration
 */
export interface ExtractionConfig {
  timeoutMs: number;
  concurrency: number;
  minSnippetLength: number;
  maxSnippetLength: number;
  userAgent: string;
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Research pipeline configuration
 */
export interface ResearchPipelineConfig {
  maxIterations: number;
  defaultRelevancyThreshold: number;
  defaultMinResults: number;
  defaultMaxResults: number;
  relevancyBatchSize: number;
}

/**
 * Topic clustering configuration
 */
export interface ClusteringConfig {
  enabled: boolean;
  similarityThreshold: number;
}

/**
 * Report generation configuration
 */
export interface ReportConfig {
  defaultTone: "professional" | "casual" | "technical";
  maxLength: number;
  includeExecutiveSummary: boolean;
}

/**
 * Rate limiting and cost control configuration
 */
export interface LimitsConfig {
  maxTokensPerRun: number;
  apiDelayMs: number;
  maxConcurrentLlmRequests: number;
}

/**
 * Complete research configuration
 */
export interface ResearchConfig {
  llm: LLMConfig;
  search: SearchConfig;
  extraction: ExtractionConfig;
  research: ResearchPipelineConfig;
  clustering: ClusteringConfig;
  report: ReportConfig;
  limits: LimitsConfig;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default configuration values (used when config file is not found)
 */
export const DEFAULT_CONFIG: ResearchConfig = {
  llm: {
    provider: "openai",
    models: {
      queryGeneration: {
        model: "gpt-4o-mini",
        temperature: 0.8,
        responseFormat: "json_object",
      },
      searchFiltering: {
        model: "gpt-4o-mini",
        temperature: 0.2,
        responseFormat: "json_object",
      },
      relevancyAnalysis: {
        model: "gpt-4o-mini",
        temperature: 0.3,
        responseFormat: "json_object",
      },
      reportCompilation: {
        model: "gpt-4o-mini",
        temperature: 0.3,
        responseFormat: "json_object",
      },
      clusteredReportCompilation: {
        model: "gpt-4o-mini",
        temperature: 0.3,
        responseFormat: "json_object",
      },
      reportSummary: {
        model: "gpt-4o-mini",
        temperature: 0.2,
        responseFormat: "json_object",
      },
    },
    embeddings: {
      model: "text-embedding-3-small",
      dimensions: 1536,
    },
  },
  search: {
    provider: "brave",
    queriesPerIteration: 5,
    resultsPerQuery: 5,
    maxUrlsToExtract: 25,
    safeSearch: "moderate",
  },
  extraction: {
    timeoutMs: 10000,
    concurrency: 5,
    minSnippetLength: 200,
    maxSnippetLength: 500,
    userAgent:
      "Mozilla/5.0 (compatible; ResearchBot/1.0; +https://example.com/bot)",
    maxRetries: 2,
    retryDelayMs: 1000,
  },
  research: {
    maxIterations: 3,
    defaultRelevancyThreshold: 60,
    defaultMinResults: 5,
    defaultMaxResults: 15,
    relevancyBatchSize: 10,
  },
  clustering: {
    enabled: true,
    similarityThreshold: 0.85,
  },
  report: {
    defaultTone: "professional",
    maxLength: 5000,
    includeExecutiveSummary: true,
  },
  limits: {
    maxTokensPerRun: 50000,
    apiDelayMs: 100,
    maxConcurrentLlmRequests: 3,
  },
};

// =============================================================================
// Configuration Loader
// =============================================================================

let cachedConfig: ResearchConfig | null = null;
let configPath: string | null = null;

/**
 * Find the research-config.yaml file by searching upward from a starting directory
 */
function findConfigFile(startDir?: string): string | null {
  const filename = "research-config.yaml";
  let currentDir = startDir || process.cwd();

  // Search up to 10 levels up
  for (let i = 0; i < 10; i++) {
    const configFilePath = path.join(currentDir, filename);
    if (fs.existsSync(configFilePath)) {
      return configFilePath;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Deep merge two objects, with source taking precedence
 */
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, any>,
        sourceValue as Record<string, any>
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Load configuration from YAML file
 */
export function loadConfig(customPath?: string): ResearchConfig {
  // Return cached config if available and no custom path specified
  if (cachedConfig && !customPath) {
    return cachedConfig;
  }

  // Find config file
  const filePath = customPath || findConfigFile();

  if (!filePath) {
    console.warn("research-config.yaml not found, using default configuration");
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }

  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const rawConfig = yaml.load(fileContents) as Partial<ResearchConfig>;

    // Merge with defaults to ensure all fields are present
    const config = deepMerge(DEFAULT_CONFIG, rawConfig);

    // Cache the config
    cachedConfig = config;
    configPath = filePath;

    console.log(`Loaded research config from: ${filePath}`);
    return config;
  } catch (error) {
    console.error(`Error loading config from ${filePath}:`, error);
    console.warn("Using default configuration");
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

/**
 * Get the currently loaded configuration
 * Loads from file if not yet loaded
 */
export function getConfig(): ResearchConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

/**
 * Clear the cached configuration (useful for testing or reloading)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configPath = null;
}

/**
 * Get the path to the loaded config file
 */
export function getConfigPath(): string | null {
  return configPath;
}

/**
 * Override specific configuration values at runtime
 * Useful for testing or per-request customization
 */
export function withConfigOverrides(
  overrides: Partial<ResearchConfig>
): ResearchConfig {
  const baseConfig = getConfig();
  return deepMerge(baseConfig, overrides);
}

// =============================================================================
// Convenience Getters
// =============================================================================

/**
 * Get model configuration for a specific step
 */
export function getModelConfig(step: keyof LLMConfig["models"]): ModelConfig {
  return getConfig().llm.models[step];
}

/**
 * Get the default LLM provider
 */
export function getDefaultLLMProvider(): "openai" | "gemini" {
  return getConfig().llm.provider;
}

/**
 * Get the default search provider
 */
export function getDefaultSearchProvider(): "brave" | "google" | "bing" {
  return getConfig().search.provider;
}

/**
 * Get embeddings configuration
 */
export function getEmbeddingsConfig(): LLMConfig["embeddings"] {
  return getConfig().llm.embeddings;
}

/**
 * Get extraction configuration
 */
export function getExtractionConfig(): ExtractionConfig {
  return getConfig().extraction;
}

/**
 * Get research pipeline configuration
 */
export function getResearchConfig(): ResearchPipelineConfig {
  return getConfig().research;
}

/**
 * Get clustering configuration
 */
export function getClusteringConfig(): ClusteringConfig {
  return getConfig().clustering;
}

/**
 * Get report configuration
 */
export function getReportConfig(): ReportConfig {
  return getConfig().report;
}

/**
 * Get limits configuration
 */
export function getLimitsConfig(): LimitsConfig {
  return getConfig().limits;
}

/**
 * Get search configuration
 */
export function getSearchConfig(): SearchConfig {
  return getConfig().search;
}
