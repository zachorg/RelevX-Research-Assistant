/**
 * Search query generation using OpenAI
 */

import { getClient } from "./client";
import type { SearchParameters } from "../../models/project";
import type { QueryPerformance } from "../../models/search-history";
import type { GeneratedQuery } from "./types";

/**
 * Generate optimized search queries from project description
 */
export async function generateSearchQueries(
  description: string,
  searchParams?: SearchParameters,
  previousQueries?: QueryPerformance[],
  iteration: number = 1
): Promise<GeneratedQuery[]> {
  const client = getClient();

  // Build context about what to consider
  const contextParts: string[] = [];

  if (searchParams?.priorityDomains?.length) {
    contextParts.push(
      `Priority domains: ${searchParams.priorityDomains.join(", ")}`
    );
  }

  if (searchParams?.requiredKeywords?.length) {
    contextParts.push(
      `Required keywords: ${searchParams.requiredKeywords.join(", ")}`
    );
  }

  if (searchParams?.excludedKeywords?.length) {
    contextParts.push(
      `Keywords to avoid: ${searchParams.excludedKeywords.join(", ")}`
    );
  }

  if (searchParams?.language) {
    contextParts.push(`Language: ${searchParams.language}`);
  }

  // Add information about previous query performance
  let queryPerformanceContext = "";
  if (previousQueries && previousQueries.length > 0) {
    const topQueries = previousQueries
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3);

    if (topQueries.length > 0) {
      queryPerformanceContext = `\n\nPrevious successful queries (for reference, create NEW variations):\n${topQueries
        .map(
          (q) =>
            `- "${q.query}" (${q.successRate.toFixed(0)}% success rate, ${
              q.relevantUrlsFound
            } relevant results)`
        )
        .join("\n")}`;
    }
  }

  // Adjust strategy based on iteration
  let iterationGuidance = "";
  if (iteration === 2) {
    iterationGuidance =
      "\n\nThis is retry iteration 2. Generate broader queries with less restrictive terms.";
  } else if (iteration === 3) {
    iterationGuidance =
      "\n\nThis is retry iteration 3 (final attempt). Generate very broad queries with alternative phrasings.";
  }

  const systemPrompt = `You are a search query optimization expert. Your task is to generate diverse, effective search queries that will find relevant content on the web.

Generate 5-7 search queries using different strategies:
1. BROAD queries - general terms that cast a wide net
2. SPECIFIC queries - precise terms with specific details
3. QUESTION queries - phrased as questions people might ask
4. TEMPORAL queries - include recency indicators like "latest", "recent", "2024", "new"

Each query should be distinct and approach the topic from different angles.
Queries should be concise (3-8 words typically) and use natural search language.`;

  const userPrompt = `Project Description:
${description}

${
  contextParts.length > 0
    ? `Additional Context:\n${contextParts.join("\n")}\n`
    : ""
}${queryPerformanceContext}${iterationGuidance}

Generate 5-7 diverse search queries. Return ONLY a JSON object with this structure:
{
  "queries": [
    {
      "query": "the search query text",
      "type": "broad|specific|question|temporal",
      "reasoning": "brief explanation of strategy"
    }
  ]
}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Parse the response - handle both array and object with queries array
    let parsed = JSON.parse(content);
    let queries: GeneratedQuery[];

    if (Array.isArray(parsed)) {
      queries = parsed;
    } else if (parsed.queries && Array.isArray(parsed.queries)) {
      queries = parsed.queries;
    } else {
      console.error(
        "Unexpected response format. Received:",
        JSON.stringify(parsed, null, 2)
      );
      throw new Error("Unexpected response format from OpenAI");
    }

    return queries.slice(0, 7); // Ensure max 7 queries
  } catch (error) {
    console.error("Error generating search queries:", error);
    throw error;
  }
}

/**
 * Generate search queries with retry logic
 */
export async function generateSearchQueriesWithRetry(
  description: string,
  searchParams?: SearchParameters,
  previousQueries?: QueryPerformance[],
  iteration: number = 1,
  maxRetries: number = 3
): Promise<GeneratedQuery[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateSearchQueries(
        description,
        searchParams,
        previousQueries,
        iteration
      );
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Query generation attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      if (attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to generate queries after ${maxRetries} attempts: ${lastError?.message}`
  );
}
