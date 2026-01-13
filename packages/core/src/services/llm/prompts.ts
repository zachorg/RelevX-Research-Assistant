/**
 * AI Prompt Configuration
 *
 * Centralized location for all AI prompts used in the research system.
 * Prompts use template placeholders that are filled at runtime.
 *
 * Template syntax: {{placeholder}} - will be replaced with actual values
 *
 * Model and temperature settings are loaded from research-config.yaml
 * and can be overridden at runtime via ResearchOptions.
 */

import {
  getModelConfig,
  type ModelConfig,
  type LLMConfig,
} from "../research-engine/config";

export interface PromptConfig {
  system: string;
  user: string;
  model: string;
  responseFormat?: "json_object" | "text";
  temperature?: number; // 0.0-2.0, lower = more deterministic, higher = more creative
}

/**
 * Model step types that can be configured
 */
type ModelStep = keyof LLMConfig["models"];

/**
 * Get prompt config with model settings from research config
 */
function createPromptConfig(
  step: ModelStep,
  system: string,
  user: string
): PromptConfig {
  const modelConfig = getModelConfig(step);
  return {
    system,
    user,
    model: modelConfig.model,
    temperature: modelConfig.temperature,
    responseFormat: modelConfig.responseFormat,
  };
}

/**
 * Prompt templates for query generation
 * Model and temperature loaded from research-config.yaml
 */
export function getQueryGenerationPrompts(): PromptConfig {
  return createPromptConfig(
    "queryGeneration",
    `You are a search query optimization expert. Your task is to generate diverse, effective search queries that will find relevant content on the web.

Generate 5 search queries using different strategies:
1. BROAD queries - general terms that cast a wide net
2. SPECIFIC queries - precise terms with specific details
3. QUESTION queries - phrased as questions people might ask
4. TEMPORAL queries - include recency indicators like "latest", "recent", "2024", "new"

Each query should be distinct and approach the topic from different angles.
Queries should be concise (3-8 words typically) and use natural search language.`,
    `Project Description:
{{description}}

{{additionalContext}}{{queryPerformanceContext}}{{iterationGuidance}}

Generate 5 diverse search queries. Return ONLY a JSON object with this structure:
{
  "queries": [
    {
      "query": "the search query text",
      "type": "broad|specific|question|temporal",
      "reasoning": "brief explanation of strategy"
    }
  ]
}`
  );
}

// Legacy export for backward compatibility
export const QUERY_GENERATION_PROMPTS: PromptConfig =
  getQueryGenerationPrompts();

/**
 * Prompt templates for search result filtering
 * Model and temperature loaded from research-config.yaml
 */
export function getSearchResultFilteringPrompts(): PromptConfig {
  return createPromptConfig(
    "searchFiltering",
    `You are a strict research curator. Your task is to filter search results based on their title and snippet to decide if they are worth reading.

Criteria for keeping:
1. Directly relevant to the user's project.
2. Likely to contain substantial information (not just a landing page or login screen).
3. Not a duplicate or low-quality SEO spam site.

Be strict. We only want to fetch the most promising content.`,
    `Project Description:
{{description}}

Search Results to Filter:
{{results}}

Evaluate each result and return ONLY a JSON object with this structure:
{
  "results": [
    {
      "url": "the result url",
      "keep": true/false,
      "reasoning": "brief reason"
    }
  ]
}`
  );
}

// Legacy export for backward compatibility
export const SEARCH_RESULT_FILTERING_PROMPTS: PromptConfig =
  getSearchResultFilteringPrompts();

/**
 * Prompt templates for relevancy analysis
 * Model and temperature loaded from research-config.yaml
 */
export function getRelevancyAnalysisPrompts(): PromptConfig {
  return createPromptConfig(
    "relevancyAnalysis",
    `You are a content relevancy analyst. Your task is to analyze web content and determine how relevant it is to a user's research project.

For each piece of content, provide:
1. A relevancy score (0-100) where:
   - 90-100: Highly relevant, directly addresses the topic
   - 70-89: Very relevant, covers important aspects
   - 50-69: Moderately relevant, tangentially related
   - 30-49: Slightly relevant, mentions the topic
   - 0-29: Not relevant or off-topic

2. Clear reasoning explaining the score
3. Key relevant points found in the content
4. Whether it meets the minimum threshold for inclusion`,
    `Project Description:
{{projectDescription}}

{{requirements}}
Minimum Relevancy Threshold: {{threshold}}

Content to Analyze:
{{contentsFormatted}}

Analyze each piece of content and return ONLY a JSON object with this structure:
{
  "results": [
    {
      "url": "the content URL",
      "score": 0-100,
      "reasoning": "explanation of the score",
      "keyPoints": ["point 1", "point 2", "point 3"],
      "isRelevant": true or false (based on threshold)
    }
  ]
}`
  );
}

// Legacy export for backward compatibility
export const RELEVANCY_ANALYSIS_PROMPTS: PromptConfig =
  getRelevancyAnalysisPrompts();

/**
 * Prompt templates for report compilation
 * Model and temperature loaded from research-config.yaml
 */
export function getReportCompilationPrompts(): PromptConfig {
  return createPromptConfig(
    "reportCompilation",
    `You are a research assistant delivering factual, data-rich reports in a vertical newsletter format.

**Report Structure:**
Present each news item in a vertical reading flow:

**Bold Title Here (no link)**

One sentence summary that captures the key takeaway.

[Details section - format varies based on content type]

*Source: [Publication Name](url) | January 8, 2026*

---

**Details Section Formatting:**
Choose the best format for each item's details based on the content:

- **Prose paragraph**: For narrative news, context, or analysis. Write dense, fact-packed sentences.
- **Bullet points**: For multiple distinct facts, features, or updates that don't need comparison.
- **Table**: For structured data like specs, pricing, comparisons, release dates, or any data with consistent attributes.
- **Mixed**: Combine formats when appropriate (e.g., a paragraph followed by a specs table).

**Core Principles:**
1. **Title**: Bold text only, NO hyperlink on title
2. **One-Line Summary**: A single sentence below the title. Keep it short - helps reader decide if they want details.
3. **Flexible Details**: Present information in whatever format best serves the content. Pack in facts - numbers, names, dates, amounts, specs.
4. **Source Link**: Hyperlink goes on publication name in the source line, not on the title.
5. **No Filler**: Remove "It is worth noting", "Interestingly", "This highlights", "It's important to note".
6. **Complete Data**: NEVER use "etc.", "and more", "among others". List ALL items.
7. **Specific Dates**: Always use exact dates (e.g., "January 8, 2026"), never "recently" or "this week".

**Do NOT include:**
- Summary/conclusion section at the end of report
- Generic introductions
- Relevancy scores
- Links on titles

**Tone:** Direct, factual, scannable.`,
    `Project: {{projectTitle}}
Description: {{projectDescription}}
Report Frequency: {{frequency}}
Report Date: {{reportDate}}

Synthesize these findings into a newsletter-style report:

{{resultsFormatted}}

**Format each item as:**

**Bold Title Text**

One sentence summary of the key takeaway.

[Details - use the best format for this content:
 - Prose for narrative/context
 - Bullets for distinct facts
 - Tables for structured/comparative data
 - Or mix formats as needed]

*Source: [Publication Name](url) | Date*

---

**Requirements:**
- Title is bold text only (NO hyperlink on title)
- Include a 1-sentence summary below title
- Details section: choose format based on content (prose, bullets, table, or mixed)
- Pack in specific facts - numbers, dates, names, amounts, specs
- Hyperlink goes on publication name in source line
- NO summary section at end of report
- NO filler words or vague statements

Return ONLY a JSON object:
{
  "markdown": "the full markdown report in vertical newsletter format",
  "title": "Descriptive title",
  "summary": "2-3 factual sentences with key takeaways"
}`
  );
}

// Legacy export for backward compatibility
export const REPORT_COMPILATION_PROMPTS: PromptConfig =
  getReportCompilationPrompts();

/**
 * Prompt templates for clustered report compilation
 * Used when articles have been grouped by semantic similarity
 * Model and temperature loaded from research-config.yaml
 */
export function getClusteredReportCompilationPrompts(): PromptConfig {
  return createPromptConfig(
    "clusteredReportCompilation",
    `You are a research assistant delivering factual, data-rich reports in a vertical newsletter format.

**IMPORTANT: You are receiving TOPIC CLUSTERS - groups of articles covering the same story/event from different sources.**

For each cluster, synthesize information from ALL sources into ONE comprehensive section. Do NOT create separate sections for each source within a cluster.

**Report Structure:**
Present each topic cluster in a vertical reading flow:

**Bold Title Here (no link)**

One sentence summary synthesizing the key takeaway from all sources.

[Details section - combine facts from ALL sources in the cluster]

*Sources: [Pub1](url1) | Date1 | [Pub2](url2) | Date2*

---

**Details Section Formatting:**
Choose the best format based on the combined content:

- **Prose paragraph**: For narrative news, context, or analysis. Write dense, fact-packed sentences.
- **Bullet points**: For multiple distinct facts, features, or updates. Combine unique points from all sources.
- **Table**: For structured data like specs, pricing, comparisons, release dates.
- **Mixed**: Combine formats when appropriate.

**Core Principles:**
1. **Title**: Bold text only, NO hyperlink on title. Create a comprehensive title that covers the topic.
2. **One-Line Summary**: Synthesize the key takeaway from ALL sources in the cluster.
3. **Merge Information**: Combine unique facts from all sources. Don't repeat the same fact from different sources.
4. **Multiple Sources**: List ALL sources at the end, formatted as: *Sources: [Name1](url1) | Date1 | [Name2](url2) | Date2*
5. **No Filler**: Remove "It is worth noting", "Interestingly", "This highlights".
6. **Complete Data**: NEVER use "etc.", "and more", "among others". List ALL items.
7. **Specific Dates**: Always use exact dates (e.g., "January 8, 2026"), never "recently" or "this week".

**Do NOT:**
- Create separate sections for articles in the same cluster
- Include summary/conclusion section at the end
- Include relevancy scores
- Put links on titles

**Tone:** Direct, factual, scannable.`,
    `Project: {{projectTitle}}
Description: {{projectDescription}}
Report Frequency: {{frequency}}
Report Date: {{reportDate}}

Synthesize these TOPIC CLUSTERS into a newsletter-style report. Each cluster contains related articles about the same topic - combine them into ONE section per cluster:

{{clustersFormatted}}

**Format each CLUSTER as ONE section:**

**Bold Title Text** (synthesize a title covering the whole topic)

One sentence summary combining insights from all sources.

[Details - merge unique facts from ALL sources in the cluster:
 - Prose for narrative/context
 - Bullets for distinct facts
 - Tables for structured/comparative data
 - Or mix formats as needed]

*Sources: [Pub1](url1) | Date1 | [Pub2](url2) | Date2*

---

**Requirements:**
- ONE section per cluster (NOT one per article)
- Title is bold text only (NO hyperlink)
- Synthesize information from all sources in each cluster
- List ALL sources at the end of each section
- Pack in specific facts - numbers, dates, names, amounts, specs
- NO summary section at end of report
- NO filler words or vague statements

Return ONLY a JSON object:
{
  "markdown": "the full markdown report in vertical newsletter format",
  "title": "Descriptive title",
  "summary": "2-3 factual sentences with key takeaways"
}`
  );
}

// Legacy export for backward compatibility
export const CLUSTERED_REPORT_COMPILATION_PROMPTS: PromptConfig =
  getClusteredReportCompilationPrompts();

/**
 * Prompt for generating executive summary from completed report
 * Called as a separate step after report compilation
 * Model and temperature loaded from research-config.yaml
 */
export function getReportSummaryPrompts(): PromptConfig {
  return createPromptConfig(
    "reportSummary",
    `You are an expert at writing concise executive summaries. Given a research report, extract the 2-3 most important findings and write a brief, fact-dense summary.

**Guidelines:**
- Focus on the most significant or impactful news items
- Include specific facts: names, numbers, dates, amounts
- Be direct and concise - no filler words
- Write in complete sentences
- Do NOT start with "This report covers..." or similar meta-statements
- Jump straight into the key findings`,
    `Write a 2-3 sentence executive summary for this research report:

Project: {{projectTitle}}
Description: {{projectDescription}}

Report Content:
{{reportMarkdown}}

Return ONLY a JSON object:
{
  "summary": "2-3 factual sentences highlighting the most important findings"
}`
  );
}

// Legacy export for backward compatibility
export const REPORT_SUMMARY_PROMPTS: PromptConfig = getReportSummaryPrompts();

/**
 * Helper function to replace template placeholders
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | number>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replace(new RegExp(placeholder, "g"), String(value));
  }
  return rendered;
}

/**
 * Get prompt configuration by type
 * Now returns fresh config each time to reflect any config changes
 */
export type PromptType =
  | "query-generation"
  | "search-result-filtering"
  | "relevancy-analysis"
  | "report-compilation"
  | "clustered-report-compilation"
  | "report-summary";

export function getPromptConfig(type: PromptType): PromptConfig {
  switch (type) {
    case "query-generation":
      return getQueryGenerationPrompts();
    case "relevancy-analysis":
      return getRelevancyAnalysisPrompts();
    case "search-result-filtering":
      return getSearchResultFilteringPrompts();
    case "report-compilation":
      return getReportCompilationPrompts();
    case "clustered-report-compilation":
      return getClusteredReportCompilationPrompts();
    case "report-summary":
      return getReportSummaryPrompts();
    default:
      throw new Error(`Unknown prompt type: ${type}`);
  }
}

/**
 * Get prompt configuration with custom model overrides
 * Useful for per-request customization
 */
export function getPromptConfigWithOverrides(
  type: PromptType,
  overrides?: Partial<ModelConfig>
): PromptConfig {
  const baseConfig = getPromptConfig(type);

  if (!overrides) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    model: overrides.model ?? baseConfig.model,
    temperature: overrides.temperature ?? baseConfig.temperature,
    responseFormat: overrides.responseFormat ?? baseConfig.responseFormat,
  };
}
