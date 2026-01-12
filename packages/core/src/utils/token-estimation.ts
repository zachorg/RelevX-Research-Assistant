/**
 * Token estimation utilities for LLM cost tracking
 *
 * These are approximate estimates based on typical tokenization ratios.
 * Actual token counts may vary depending on the specific content and model.
 */

/**
 * Pricing per 1M tokens (as of 2024)
 * Input/Output prices in USD
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> =
  {
    // OpenAI models
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },

    // Gemini models
    "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
    "gemini-1.5-flash": { input: 0.075, output: 0.3 },
    "gemini-1.5-pro": { input: 1.25, output: 5 },
    "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  };

/**
 * Estimate token count from text
 * Uses a simple heuristic: ~4 characters per token for English text
 * This is a rough estimate - actual tokenization varies by model
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Average ~4 characters per token for English text
  // This is a commonly used heuristic for GPT models
  return Math.ceil(text.length / 4);
}

/**
 * Token usage tracker for accumulating usage across multiple LLM calls
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Create a new token usage tracker
 */
export function createTokenUsageTracker(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

/**
 * Add estimated tokens to the tracker
 */
export function addTokenUsage(
  tracker: TokenUsage,
  inputText: string,
  outputText: string
): void {
  const input = estimateTokens(inputText);
  const output = estimateTokens(outputText);
  tracker.inputTokens += input;
  tracker.outputTokens += output;
  tracker.totalTokens += input + output;
}

/**
 * Estimate cost in USD based on token usage and model
 */
export function estimateCost(usage: TokenUsage, model: string): number {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    // Default to gpt-4o-mini pricing if model not found
    const defaultPricing = MODEL_PRICING["gpt-4o-mini"];
    return (
      (usage.inputTokens * defaultPricing.input +
        usage.outputTokens * defaultPricing.output) /
      1_000_000
    );
  }

  return (
    (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) /
    1_000_000
  );
}

/**
 * Format cost as a readable string
 */
export function formatCost(costUsd: number): string {
  if (costUsd < 0.01) {
    return `$${(costUsd * 100).toFixed(3)} cents`;
  }
  return `$${costUsd.toFixed(4)}`;
}
