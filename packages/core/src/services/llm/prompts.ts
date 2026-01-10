/**
 * AI Prompt Configuration
 *
 * Centralized location for all AI prompts used in the research system.
 * Prompts use template placeholders that are filled at runtime.
 *
 * Template syntax: {{placeholder}} - will be replaced with actual values
 */

export interface PromptConfig {
  system: string;
  user: string;
  model: string;
  responseFormat?: "json_object" | "text";
  temperature?: number; // 0.0-2.0, lower = more deterministic, higher = more creative
}

/**
 * Prompt templates for query generation
 */
export const QUERY_GENERATION_PROMPTS: PromptConfig = {
  model: "gpt-4o-mini",
  responseFormat: "json_object",
  temperature: 0.8, // Higher for creative, diverse query generation
  system: `You are a search query optimization expert. Your task is to generate diverse, effective search queries that will find relevant content on the web.

Generate 5 search queries using different strategies:
1. BROAD queries - general terms that cast a wide net
2. SPECIFIC queries - precise terms with specific details
3. QUESTION queries - phrased as questions people might ask
4. TEMPORAL queries - include recency indicators like "latest", "recent", "2024", "new"

Each query should be distinct and approach the topic from different angles.
Queries should be concise (3-8 words typically) and use natural search language.`,
  user: `Project Description:
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
}`,
};

/**
 * Prompt templates for search result filtering
 */
export const SEARCH_RESULT_FILTERING_PROMPTS: PromptConfig = {
  model: "gpt-4o-mini",
  responseFormat: "json_object",
  temperature: 0.2, // Low for consistent binary decisions
  system: `You are a strict research curator. Your task is to filter search results based on their title and snippet to decide if they are worth reading.

Criteria for keeping:
1. Directly relevant to the user's project.
2. Likely to contain substantial information (not just a landing page or login screen).
3. Not a duplicate or low-quality SEO spam site.

Be strict. We only want to fetch the most promising content.`,
  user: `Project Description:
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
}`,
};

/**
 * Prompt templates for relevancy analysis
 */
export const RELEVANCY_ANALYSIS_PROMPTS: PromptConfig = {
  model: "gpt-4o-mini",
  responseFormat: "json_object",
  temperature: 0.3, // Low for consistent scoring
  system: `You are a content relevancy analyst. Your task is to analyze web content and determine how relevant it is to a user's research project.

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
  user: `Project Description:
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
}`,
};

/**
 * Prompt templates for report compilation
 */
export const REPORT_COMPILATION_PROMPTS: PromptConfig = {
  model: "gpt-4o-mini",
  responseFormat: "json_object",
  temperature: 0.3, // Low for factual, consistent output
  system: `You are a research assistant delivering factual, data-rich reports. Your reports should feel like getting answers, not reading an article.

**Core Principles:**
1. **Dense Information**: Every sentence must add new information. Remove all filler phrases like "It is worth noting", "Interestingly", "In the ever-evolving landscape", "This highlights", "It's important to note".
2. **Structured Data**: Use tables for comparisons, lists, releases, pricing, statistics, or any set of 3+ related items. Tables are easier to scan than prose.
3. **Complete Data**: NEVER summarize lists with "etc.", "and more", "among others", or "such as X and Y". Provide the FULL list from your sources. If there are 10 items, list all 10.
4. **Specific Dates**: Always include exact dates when available (e.g., "January 8, 2026"). Never use vague terms like "recently", "this week", "soon" when you have actual dates.
5. **Embedded Citations**: Link sources inline using markdown (e.g., "[announced](url)"). Place the link on the most relevant word or phrase.

**Formatting Rules:**
- Use ## for major sections, ### for subsections
- Use tables for: releases, comparisons, statistics, timelines, pricing, specs
- Use bullet lists for quick standalone facts
- Bold key terms, names, numbers, and dates for scannability
- Keep paragraphs short (2-3 sentences max)

**Table Format Example:**
| Date | Event | Details |
|------|-------|---------|
| Jan 5, 2026 | [Product X Launch](url) | Key specs here |

**Do NOT include:**
- Executive Summary sections
- Generic introductions ("In this report we will cover...")
- Generic conclusions ("In conclusion...", "Overall...", "To summarize...")
- Relevancy scores
- Phrases that don't add information

**Tone:** Direct, factual, scannable. Write for someone who wants answers fast.`,
  user: `Project: {{projectTitle}}
Description: {{projectDescription}}
Report Frequency: {{frequency}}
Report Date: {{reportDate}}

Synthesize these findings into a structured, data-rich report:

{{resultsFormatted}}

**Frequency-specific guidelines:**
- Daily reports: Include exact dates for ALL events. Users need to know what happened TODAY vs yesterday.
- Weekly reports: Group by day when relevant. Include specific dates, not "this week".
- Monthly reports: Use tables for chronological data. Include week/date ranges.

**Remember:**
- Use tables for any list of 3+ items
- Include ALL items from lists, never use "etc."
- Include specific dates whenever available
- Every sentence must add new information

Return ONLY a JSON object:
{
  "markdown": "the full markdown report with tables and structured data",
  "title": "Descriptive title that tells users what they'll learn",
  "summary": "2-3 factual sentences with key takeaways, no fluff"
}`,
};

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
 */
export type PromptType =
  | "query-generation"
  | "search-result-filtering"
  | "relevancy-analysis"
  | "report-compilation";

export function getPromptConfig(type: PromptType): PromptConfig {
  switch (type) {
    case "query-generation":
      return QUERY_GENERATION_PROMPTS;
    case "relevancy-analysis":
      return RELEVANCY_ANALYSIS_PROMPTS;
    case "search-result-filtering":
      return SEARCH_RESULT_FILTERING_PROMPTS;
    case "report-compilation":
      return REPORT_COMPILATION_PROMPTS;
    default:
      throw new Error(`Unknown prompt type: ${type}`);
  }
}
