/**
 * Report compilation using OpenAI
 */

import { getClient } from "./client";
import type { SearchParameters } from "../../models/project";
import type { ResultForReport, CompiledReport } from "./types";

/**
 * Compile relevant results into a markdown report
 */
export async function compileReport(
  results: ResultForReport[],
  projectTitle: string,
  projectDescription: string,
  searchParams?: SearchParameters
): Promise<CompiledReport> {
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
    .map(
      (r, idx) => `
Result ${idx + 1}:
URL: ${r.url}
Title: ${r.title || "N/A"}
Score: ${r.score}/100
Published: ${r.publishedDate || "Unknown"}
Author: ${r.author || "Unknown"}
Key Points: ${r.keyPoints.join("; ")}
${r.imageUrl ? `Image: ${r.imageUrl} (Alt: ${r.imageAlt || "N/A"})` : ""}
Snippet:
${r.snippet}
---`
    )
    .join("\n");

  const systemPrompt = `You are a research report compiler. Your task is to create a comprehensive, well-structured markdown report from research findings.

The report should:
1. Have a clear executive summary at the top
2. Be organized into logical sections by topic/theme
3. Include all relevant results with proper citations
4. Use markdown formatting (headers, lists, bold, links, images)
5. Include images where available
6. Provide context and analysis, not just list results
7. Be professional and easy to read

Use markdown features:
- # for main title, ## for sections, ### for subsections
- **bold** for emphasis
- [link text](url) for citations
- ![alt text](image-url) for images
- Bullet points for lists
- > for important quotes or highlights`;

  const userPrompt = `Project: ${projectTitle}
Description: ${projectDescription}

Create a comprehensive markdown report from these ${results.length} research findings:

${resultsFormatted}

Return ONLY a JSON object with this structure:
{
  "markdown": "the full markdown report",
  "title": "report title",
  "summary": "2-3 sentence executive summary"
}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini", // Use better model for final report
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
  results: ResultForReport[],
  projectTitle: string,
  projectDescription: string,
  searchParams?: SearchParameters,
  maxRetries: number = 3
): Promise<CompiledReport> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await compileReport(
        results,
        projectTitle,
        projectDescription,
        searchParams
      );
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
