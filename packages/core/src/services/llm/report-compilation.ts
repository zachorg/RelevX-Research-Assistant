/**
 * Report compilation using OpenAI
 */

import { getClient } from "./client";
import {
  REPORT_COMPILATION_PROMPTS,
  CLUSTERED_REPORT_COMPILATION_PROMPTS,
  REPORT_SUMMARY_PROMPTS,
  renderPrompt,
} from "./prompts";
import type { SearchParameters, Frequency } from "../../models/project";
import type { ResultForReport, CompiledReport, TopicCluster } from "./types";
import { formatReadableDate } from "../../utils/date-filters";

/**
 * Options for report compilation
 */
export interface CompileReportOptions {
  results: ResultForReport[];
  projectTitle: string;
  projectDescription: string;
  frequency?: Frequency;
  searchParams?: SearchParameters;
}

/**
 * Format date for display in reports
 */
function formatReportDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Compile relevant results into a markdown report
 */
export async function compileReport(
  options: CompileReportOptions
): Promise<CompiledReport> {
  const {
    results,
    projectTitle,
    projectDescription,
    frequency = "weekly",
  } = options;

  const client = getClient();

  if (results.length === 0) {
    return {
      markdown: `# ${projectTitle}\n\nNo relevant results found for this research period.`,
      title: projectTitle,
      summary: "No relevant results were found.",
      resultCount: 0,
      averageScore: 0,
    };
  }

  // Sort results by score
  const sortedResults = [...results].sort((a, b) => b.score - a.score);

  const resultsFormatted = sortedResults
    .map((r, idx) => {
      const publishedDate = formatReadableDate(r.publishedDate);
      return `
Result ${idx + 1}:
URL: ${r.url}
Title: ${r.title || "N/A"}
Score: ${r.score}/100
${publishedDate ? `Published: ${publishedDate}` : ""}
Author: ${r.author || "Unknown"}
Key Points: ${r.keyPoints.join("; ")}
${r.imageUrl ? `Image: ${r.imageUrl} (Alt: ${r.imageAlt || "N/A"})` : ""}
Snippet:
${r.snippet}
---`;
    })
    .join("\n");

  // Render user prompt with template variables
  const userPrompt = renderPrompt(REPORT_COMPILATION_PROMPTS.user, {
    projectTitle,
    projectDescription,
    frequency,
    reportDate: formatReportDate(),
    resultCount: results.length,
    resultsFormatted,
  });

  try {
    const response = await client.chat.completions.create({
      model: REPORT_COMPILATION_PROMPTS.model,
      temperature: REPORT_COMPILATION_PROMPTS.temperature ?? 0.7,
      messages: [
        { role: "system", content: REPORT_COMPILATION_PROMPTS.system },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: REPORT_COMPILATION_PROMPTS.responseFormat || "json_object",
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const parsed = JSON.parse(content);

    const averageScore =
      results.reduce((sum, r) => sum + r.score, 0) / results.length;

    return {
      markdown: parsed.markdown,
      title: parsed.title || projectTitle,
      summary: parsed.summary || "",
      resultCount: results.length,
      averageScore: Math.round(averageScore),
    };
  } catch (error) {
    console.error("Error compiling report:", error);
    throw error;
  }
}

/**
 * Compile report with retry logic
 */
export async function compileReportWithRetry(
  options: CompileReportOptions,
  maxRetries: number = 3
): Promise<CompiledReport> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await compileReport(options);
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Report compilation attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to compile report after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Options for clustered report compilation
 */
export interface CompileClusteredReportOptions {
  clusters: TopicCluster[];
  projectTitle: string;
  projectDescription: string;
  frequency?: Frequency;
  searchParams?: SearchParameters;
}

/**
 * Format a single cluster for the prompt
 */
function formatCluster(cluster: TopicCluster, idx: number): string {
  const primary = cluster.primaryArticle;
  const related = cluster.relatedArticles;
  const allArticles = [primary, ...related];

  // Format sources list with human-readable dates (omit date if not available)
  const sourcesFormatted = cluster.allSources
    .map((s) => {
      const date = formatReadableDate(s.publishedDate);
      return `  - ${s.name}: ${s.url}${date ? ` (${date})` : ""}`;
    })
    .join("\n");

  // Format all key points from cluster
  const keyPointsFormatted = cluster.combinedKeyPoints
    .map((p) => `  - ${p}`)
    .join("\n");

  // Format snippets from all articles
  const snippetsFormatted = allArticles
    .map(
      (a) =>
        `  [${a.title || "Untitled"}]: ${a.snippet.substring(0, 300)}${
          a.snippet.length > 300 ? "..." : ""
        }`
    )
    .join("\n\n");

  return `
=== CLUSTER ${idx + 1} (${allArticles.length} source${
    allArticles.length > 1 ? "s" : ""
  }) ===
Topic: ${cluster.topic}
Average Score: ${cluster.averageScore}/100

SOURCES:
${sourcesFormatted}

KEY POINTS (merged from all sources):
${keyPointsFormatted}

CONTENT SNIPPETS:
${snippetsFormatted}
---`;
}

/**
 * Compile clustered results into a markdown report
 * Uses topic clusters to consolidate similar articles
 */
export async function compileClusteredReport(
  options: CompileClusteredReportOptions
): Promise<CompiledReport> {
  const {
    clusters,
    projectTitle,
    projectDescription,
    frequency = "weekly",
  } = options;

  const client = getClient();

  if (clusters.length === 0) {
    return {
      markdown: `# ${projectTitle}\n\nNo relevant results found for this research period.`,
      title: projectTitle,
      summary: "No relevant results were found.",
      resultCount: 0,
      averageScore: 0,
    };
  }

  // Sort clusters by average score
  const sortedClusters = [...clusters].sort(
    (a, b) => b.averageScore - a.averageScore
  );

  // Format clusters for prompt
  const clustersFormatted = sortedClusters
    .map((cluster, idx) => formatCluster(cluster, idx))
    .join("\n");

  // Calculate total articles and average score
  const totalArticles = clusters.reduce(
    (sum, c) => sum + 1 + c.relatedArticles.length,
    0
  );
  const overallAvgScore =
    clusters.reduce((sum, c) => sum + c.averageScore, 0) / clusters.length;

  // Render user prompt with template variables
  const userPrompt = renderPrompt(CLUSTERED_REPORT_COMPILATION_PROMPTS.user, {
    projectTitle,
    projectDescription,
    frequency,
    reportDate: formatReportDate(),
    clusterCount: clusters.length,
    totalArticles,
    clustersFormatted,
  });

  try {
    const response = await client.chat.completions.create({
      model: CLUSTERED_REPORT_COMPILATION_PROMPTS.model,
      temperature: CLUSTERED_REPORT_COMPILATION_PROMPTS.temperature ?? 0.3,
      messages: [
        {
          role: "system",
          content: CLUSTERED_REPORT_COMPILATION_PROMPTS.system,
        },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type:
          CLUSTERED_REPORT_COMPILATION_PROMPTS.responseFormat || "json_object",
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const parsed = JSON.parse(content);

    return {
      markdown: parsed.markdown,
      title: parsed.title || projectTitle,
      summary: parsed.summary || "",
      resultCount: totalArticles,
      averageScore: Math.round(overallAvgScore),
    };
  } catch (error) {
    console.error("Error compiling clustered report:", error);
    throw error;
  }
}

/**
 * Compile clustered report with retry logic
 */
export async function compileClusteredReportWithRetry(
  options: CompileClusteredReportOptions,
  maxRetries: number = 3
): Promise<CompiledReport> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await compileClusteredReport(options);
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Clustered report compilation attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to compile clustered report after ${maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Options for summary generation
 */
export interface GenerateSummaryOptions {
  reportMarkdown: string;
  projectTitle: string;
  projectDescription: string;
}

/**
 * Generate an executive summary from a completed report
 * Called as a separate step after report compilation for better quality summaries
 */
export async function generateReportSummary(
  options: GenerateSummaryOptions
): Promise<string> {
  const { reportMarkdown, projectTitle, projectDescription } = options;

  const client = getClient();

  // Render user prompt with template variables
  const userPrompt = renderPrompt(REPORT_SUMMARY_PROMPTS.user, {
    projectTitle,
    projectDescription,
    reportMarkdown,
  });

  try {
    const response = await client.chat.completions.create({
      model: REPORT_SUMMARY_PROMPTS.model,
      temperature: REPORT_SUMMARY_PROMPTS.temperature ?? 0.2,
      messages: [
        { role: "system", content: REPORT_SUMMARY_PROMPTS.system },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: REPORT_SUMMARY_PROMPTS.responseFormat || "json_object",
      },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const parsed = JSON.parse(content);
    return parsed.summary || "";
  } catch (error) {
    console.error("Error generating report summary:", error);
    throw error;
  }
}

/**
 * Generate summary with retry logic
 */
export async function generateReportSummaryWithRetry(
  options: GenerateSummaryOptions,
  maxRetries: number = 2
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateReportSummary(options);
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `Summary generation attempt ${attempt}/${maxRetries} failed:`,
        error
      );

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Return empty string instead of throwing - summary is not critical
  console.error(
    `Failed to generate summary after ${maxRetries} attempts: ${lastError?.message}`
  );
  return "";
}
