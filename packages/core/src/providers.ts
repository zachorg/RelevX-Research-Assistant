/**
 * Provider Factory Functions
 *
 * Centralized provider creation and initialization.
 * Allows easy switching between providers via configuration.
 */

import type { LLMProvider } from "./interfaces/llm-provider";
import type { SearchProvider } from "./interfaces/search-provider";
import { OpenAIProvider } from "./services/llm/openai-provider";
import { BraveSearchProvider } from "./services/search/brave-provider";

/**
 * LLM Provider types
 */
export type LLMProviderType = "openai" | "gemini" | "anthropic" | "custom";

/**
 * Search Provider types
 */
export type SearchProviderType =
  | "brave"
  | "google"
  | "bing"
  | "scrapingbee"
  | "custom";

/**
 * LLM Provider configuration
 */
export interface LLMProviderConfig {
  provider: LLMProviderType;
  apiKey: string;
  customProvider?: LLMProvider; // For custom implementations
}

/**
 * Search Provider configuration
 */
export interface SearchProviderConfig {
  provider: SearchProviderType;
  apiKey: string;
  customProvider?: SearchProvider; // For custom implementations
}

/**
 * Create an LLM provider from configuration
 */
export function createLLMProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config.apiKey);

    case "gemini":
      // TODO: Implement Gemini provider
      throw new Error(
        "Gemini provider not yet implemented. Use 'openai' or provide a custom provider."
      );

    case "anthropic":
      // TODO: Implement Anthropic provider
      throw new Error(
        "Anthropic provider not yet implemented. Use 'openai' or provide a custom provider."
      );

    case "custom":
      if (!config.customProvider) {
        throw new Error(
          "Custom LLM provider specified but not provided in config.customProvider"
        );
      }
      return config.customProvider;

    default:
      throw new Error(`Unknown LLM provider type: ${config.provider}`);
  }
}

/**
 * Create a search provider from configuration
 */
export function createSearchProvider(
  config: SearchProviderConfig
): SearchProvider {
  switch (config.provider) {
    case "brave":
      return new BraveSearchProvider(config.apiKey);

    case "google":
      // TODO: Implement Google Search provider
      throw new Error(
        "Google Search provider not yet implemented. Use 'brave' or provide a custom provider."
      );

    case "bing":
      // TODO: Implement Bing Search provider
      throw new Error(
        "Bing Search provider not yet implemented. Use 'brave' or provide a custom provider."
      );

    case "scrapingbee":
      // TODO: Implement ScrapingBee provider
      throw new Error(
        "ScrapingBee provider not yet implemented. Use 'brave' or provide a custom provider."
      );

    case "custom":
      if (!config.customProvider) {
        throw new Error(
          "Custom search provider specified but not provided in config.customProvider"
        );
      }
      return config.customProvider;

    default:
      throw new Error(`Unknown search provider type: ${config.provider}`);
  }
}

/**
 * Convenience function to create both providers at once
 */
export function createProviders(
  llmConfig: LLMProviderConfig,
  searchConfig: SearchProviderConfig
): {
  llm: LLMProvider;
  search: SearchProvider;
} {
  return {
    llm: createLLMProvider(llmConfig),
    search: createSearchProvider(searchConfig),
  };
}
