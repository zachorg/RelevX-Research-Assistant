/**
 * OpenAI Provider Implementation
 *
 * Adapter that wraps the existing OpenAI service to implement LLMProvider interface
 */

import type {
  GeneratedQuery,
  ContentToAnalyze,
  RelevancyResult,
  ResultForReport,
  CompiledReport,
  SearchResultToFilter,
  FilteredSearchResult,
  TopicCluster,
  LlmMessage,
} from "./../../services/llm/types";
import { generateSearchQueriesWithRetry as openaiGenerateQueriesRetry } from "./query-generation";
import { analyzeRelevancyWithRetry as openaiAnalyzeRelevancyRetry } from "./relevancy-analysis";
import { compileReportWithRetry as openaiCompileReportRetry } from "./report-compilation";
import { filterSearchResultsSafe } from "./search-filtering";
import { initializeOpenAI as initOpenAI, getClient } from "./client";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { LLMProvider } from "./../../interfaces";

/**
 * OpenAI implementation of LLMProvider
 */
export class OpenAIProvider implements LLMProvider {
  private initialized: boolean = false;
  private readonly modelName: string = "gpt-4o-mini";

  constructor(apiKey?: string) {
    if (apiKey) {
      initOpenAI(apiKey);
      this.initialized = true;
    }
  }
  clusterByTopic?(
    results: ResultForReport[],
    options?: { similarityThreshold?: number }
  ): Promise<TopicCluster[]> {
    throw new Error("Method not implemented.");
  }
  compileClusteredReport?(
    projectDescription: string,
    clusters: TopicCluster[],
    options?: {
      tone?: "professional" | "casual" | "technical";
      maxLength?: number;
      projectTitle?: string;
      frequency?: "daily" | "weekly" | "monthly";
    }
  ): Promise<CompiledReport> {
    throw new Error("Method not implemented.");
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return "openai";
  }

  /**
   * Get the model name being used
   */
  getModel(): string {
    return this.modelName;
  }

  /**
   * Ensure the provider is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      try {
        getClient(); // This will throw if not initialized
        this.initialized = true;
      } catch (error) {
        throw new Error(
          "OpenAI provider not initialized. Call initializeOpenAI() first or provide API key in constructor."
        );
      }
    }
  }

  async query(messages: Array<LlmMessage>, temperature?: number): Promise<any> {
    this.ensureInitialized();
    const client = getClient();

    const msgs: Array<ChatCompletionMessageParam> = [];
    for (const message of messages) {
      msgs.push({
        role: message.role,
        content: message.content,
      } as ChatCompletionMessageParam);
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: temperature ?? 0.7,
      messages: msgs,
      response_format: {
        type: "json_object",
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Parse the response - handle both array and object with queries array
    let parsed = JSON.parse(content);
    return parsed;
  }

  /**
   * Generate search queries from project description
   */
  async generateSearchQueries(
    projectDescription: string,
    _additionalContext?: string,
    options?: {
      count?: number;
    }
  ): Promise<GeneratedQuery[]> {
    this.ensureInitialized();

    // The existing OpenAI function takes different parameters
    // We'll call it with retry logic
    const queries = await openaiGenerateQueriesRetry(
      projectDescription,
      undefined, // searchParams
      undefined, // previousQueries
      options?.count ?? 1, // iteration
      3 // maxRetries
    );

    return queries;
  }

  /**
   * Filter search results based on title/snippet
   */
  async filterSearchResults(
    results: SearchResultToFilter[],
    projectDescription: string
  ): Promise<FilteredSearchResult[]> {
    this.ensureInitialized();
    return filterSearchResultsSafe(results, projectDescription);
  }

  /**
   * Analyze relevancy of content against project description
   */
  async analyzeRelevancy(
    projectDescription: string,
    contents: ContentToAnalyze[],
    options?: {
      threshold?: number;
      batchSize?: number;
    }
  ): Promise<RelevancyResult[]> {
    this.ensureInitialized();

    const threshold = options?.threshold || 60;

    // Use the existing OpenAI function with retry logic
    const results = await openaiAnalyzeRelevancyRetry(
      contents,
      projectDescription,
      undefined, // searchParams
      threshold,
      3 // maxRetries
    );

    return results;
  }

  /**
   * Compile a report from relevant results
   */
  async compileReport(
    projectDescription: string,
    results: ResultForReport[],
    options?: {
      tone?: "professional" | "casual" | "technical";
      maxLength?: number;
      projectTitle?: string;
      frequency?: "daily" | "weekly" | "monthly";
    }
  ): Promise<CompiledReport> {
    this.ensureInitialized();

    // Use the existing OpenAI function with retry logic
    const report = await openaiCompileReportRetry(
      {
        results,
        projectTitle: options?.projectTitle || "Research Report",
        projectDescription,
        frequency: options?.frequency,
      },
      3 // maxRetries
    );

    return report;
  }
}

/**
 * Factory function to create OpenAI provider
 */
export function createOpenAIProvider(apiKey: string): OpenAIProvider {
  return new OpenAIProvider(apiKey);
}
