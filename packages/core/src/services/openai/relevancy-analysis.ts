/**
 * Content relevancy analysis using OpenAI
 */

import { getClient } from "./client";
import type { SearchParameters } from "../../models/project";
import type { ContentToAnalyze, RelevancyResult } from "./types";

/**
 * Analyze relevancy of extracted content
 */
export async function analyzeRelevancy(
  contents: ContentToAnalyze[],
  projectDescription: string,
  searchParams?: SearchParameters,
  threshold: number = 60
): Promise<RelevancyResult[]> {
  const client = getClient();

  // Build context
  const contextParts: string[] = [];

  if (searchParams?.requiredKeywords?.length) {
    contextParts.push(
      `Must include these topics: ${searchParams.requiredKeywords.join(", ")}`
    );
  }

  if (searchParams?.excludedKeywords?.length) {
    contextParts.push(
      `Should NOT contain: ${searchParams.excludedKeywords.join(", ")}`
    );
  }

  const systemPrompt = `You are a content relevancy analyst. Your task is to analyze web content and determine how relevant it is to a user's research project.

For each piece of content, provide:
1. A relevancy score (0-100) where:
   - 90-100: Highly relevant, directly addresses the topic
   - 70-89: Very relevant, covers important aspects
   - 50-69: Moderately relevant, tangentially related
   - 30-49: Slightly relevant, mentions the topic
   - 0-29: Not relevant or off-topic

2. Clear reasoning explaining the score
3. Key relevant points found in the content
4. Whether it meets the minimum threshold for inclusion`;

  const contentsFormatted = contents
    .map(
      (c, idx) => `
Content ${idx + 1}:
URL: ${c.url}
Title: ${c.title || "N/A"}
Published: ${c.publishedDate || "Unknown"}
Snippet:
${c.snippet}
---`
    )
    .join("\n");

  const userPrompt = `Project Description:
${projectDescription}

${contextParts.length > 0 ? `Requirements:\n${contextParts.join("\n")}\n` : ""}
Minimum Relevancy Threshold: ${threshold}

Content to Analyze:
${contentsFormatted}

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
}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5-nano", // Use cheaper model for analysis
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

    const parsed = JSON.parse(content);
    return parsed.results || [];
  } catch (error) {
    console.error("Error analyzing relevancy:", error);
    throw error;
  }
}

/**
 * Analyze relevancy with retry logic
 */
export async function analyzeRelevancyWithRetry(
  contents: ContentToAnalyze[],
  projectDescription: string,
  searchParams?: SearchParameters,
  threshold: number = 60,
  maxRetries: number = 3
): Promise<RelevancyResult[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await analyzeRelevancy(
        contents,
        projectDescription,
        searchParams,
        threshold
      );
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Relevancy analysis attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to analyze relevancy after ${maxRetries} attempts: ${lastError?.message}`
  );
}
