/**
 * Content extraction service
 *
 * Fetches and parses web pages to extract:
 * - Main content text
 * - Headings and structure
 * - Images with alt text
 * - Metadata (title, description, author, publish date)
 *
 * Configuration is loaded from research-config.yaml
 */

import * as cheerio from "cheerio";
import { getExtractionConfig } from "./research-engine/config";

/**
 * Options for content extraction
 */
export interface ExtractionOptions {
  timeout?: number; // Request timeout in ms (default: from config)
  minSnippetLength?: number; // Minimum snippet length (default: from config)
  maxSnippetLength?: number; // Maximum snippet length (default: from config)
  userAgent?: string; // Custom user agent (default: from config)
  maxRetries?: number; // Max retries for failed extractions (default: from config)
  retryDelayMs?: number; // Retry delay in ms (default: from config)
}

/**
 * Extracted content from a web page
 */
export interface ExtractedContent {
  url: string;
  normalizedUrl: string;

  // Main content
  title?: string;
  snippet: string; // 200-500 word excerpt
  fullContent?: string; // Full text content

  // Structure
  headings: string[]; // All h1-h6 headings

  // Images
  images: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;

  // Metadata
  metadata: {
    description?: string;
    author?: string;
    publishedDate?: string;
    keywords?: string[];
    ogImage?: string; // Open Graph image
    contentType?: string; // Detected content type
  };

  // Stats
  wordCount: number;

  // Status
  fetchStatus: "success" | "failed" | "timeout" | "blocked";
  fetchError?: string;
  fetchedAt: number;
}

/**
 * Get default extraction options from config
 */
function getDefaultOptions(): Required<ExtractionOptions> {
  const config = getExtractionConfig();
  return {
    timeout: config.timeoutMs,
    minSnippetLength: config.minSnippetLength,
    maxSnippetLength: config.maxSnippetLength,
    userAgent: config.userAgent,
    maxRetries: config.maxRetries,
    retryDelayMs: config.retryDelayMs,
  };
}

/**
 * Normalize URL for deduplication
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }
    let pathname = urlObj.pathname;
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    return `${urlObj.protocol}//${hostname}${pathname}`;
  } catch (error) {
    return url.toLowerCase();
  }
}

/**
 * Extract text from HTML, removing scripts and styles
 */
function extractText($: cheerio.CheerioAPI, selector?: string): string {
  const element = selector ? $(selector) : $("body");

  // Remove unwanted elements
  element.find("script, style, nav, footer, header, aside, iframe").remove();

  // Get text and clean it up
  const text = element
    .text()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n+/g, " ") // Replace newlines with space
    .trim();

  return text;
}

/**
 * Extract main content from the page
 * Tries common content selectors
 */
function extractMainContent($: cheerio.CheerioAPI): string {
  // Common content selectors (in priority order)
  const contentSelectors = [
    "article",
    '[role="main"]',
    "main",
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
    "#content",
    ".post",
    ".article",
  ];

  for (const selector of contentSelectors) {
    const content = extractText($, selector);
    if (content.length > 100) {
      // Minimum viable content length
      return content;
    }
  }

  // Fallback to body
  return extractText($);
}

/**
 * Create snippet from content
 */
function createSnippet(
  text: string,
  minLength: number,
  maxLength: number
): string {
  const words = text.split(/\s+/);

  if (words.length <= minLength / 5) {
    // Roughly 5 chars per word
    return text;
  }

  // Find a good breaking point between min and max
  let targetWords = Math.floor(maxLength / 5);
  let snippet = words.slice(0, targetWords).join(" ");

  // Try to end on a sentence
  const lastPeriod = snippet.lastIndexOf(".");
  const lastQuestion = snippet.lastIndexOf("?");
  const lastExclamation = snippet.lastIndexOf("!");
  const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclamation);

  if (lastSentence > minLength) {
    snippet = snippet.substring(0, lastSentence + 1);
  } else {
    snippet += "...";
  }

  return snippet.trim();
}

/**
 * Extract headings from the page
 */
function extractHeadings($: cheerio.CheerioAPI): string[] {
  const headings: string[] = [];

  $("h1, h2, h3, h4, h5, h6").each((_, element) => {
    const text = $(element).text().trim();
    if (text) {
      headings.push(text);
    }
  });

  return headings;
}

/**
 * Extract images from the page
 */
function extractImages(
  $: cheerio.CheerioAPI,
  baseUrl: string
): Array<{
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}> {
  const images: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }> = [];

  $("img").each((_, element) => {
    const $img = $(element);
    let src = $img.attr("src") || $img.attr("data-src");

    if (!src) return;

    // Convert relative URLs to absolute
    try {
      const absoluteUrl = new URL(src, baseUrl).href;
      images.push({
        src: absoluteUrl,
        alt: $img.attr("alt"),
        width: $img.attr("width")
          ? parseInt($img.attr("width")!, 10)
          : undefined,
        height: $img.attr("height")
          ? parseInt($img.attr("height")!, 10)
          : undefined,
      });
    } catch (error) {
      // Skip invalid URLs
    }
  });

  return images;
}

/**
 * Extract metadata from the page
 */
function extractMetadata($: cheerio.CheerioAPI): ExtractedContent["metadata"] {
  const metadata: ExtractedContent["metadata"] = {};

  // Description
  metadata.description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content");

  // Author
  metadata.author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('[rel="author"]').text().trim();

  // Published date
  metadata.publishedDate =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $("time[datetime]").attr("datetime");

  // Keywords
  const keywordsStr = $('meta[name="keywords"]').attr("content");
  if (keywordsStr) {
    metadata.keywords = keywordsStr.split(",").map((k) => k.trim());
  }

  // Open Graph image
  metadata.ogImage = $('meta[property="og:image"]').attr("content");

  // Try to detect content type
  const ogType = $('meta[property="og:type"]').attr("content");
  if (ogType) {
    metadata.contentType = ogType;
  } else if ($("article").length > 0) {
    metadata.contentType = "article";
  } else if ($("video").length > 0 || $('[property="og:video"]').length > 0) {
    metadata.contentType = "video";
  }

  return metadata;
}

/**
 * Extract content from a URL
 */
export async function extractContent(
  url: string,
  options?: ExtractionOptions
): Promise<ExtractedContent> {
  const defaultOpts = getDefaultOptions();
  const opts = { ...defaultOpts, ...options };
  const fetchedAt = Date.now();

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    // Fetch the page
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": opts.userAgent!,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeoutId);

    // Check for errors
    if (!response.ok) {
      if (response.status === 403 || response.status === 401) {
        return {
          url,
          normalizedUrl: normalizeUrl(url),
          snippet: "",
          headings: [],
          images: [],
          metadata: {},
          wordCount: 0,
          fetchStatus: "blocked",
          fetchError: `Access denied (${response.status})`,
          fetchedAt,
        };
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Get HTML content
    const html = await response.text();

    // Parse with cheerio
    const $ = cheerio.load(html);

    // Extract page title
    const title =
      $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text().trim();

    // Extract main content
    const fullContent = extractMainContent($);
    const wordCount = fullContent.split(/\s+/).length;

    // Create snippet
    const snippet = createSnippet(
      fullContent,
      opts.minSnippetLength!,
      opts.maxSnippetLength!
    );

    // Extract other elements
    const headings = extractHeadings($);
    const images = extractImages($, url);
    const metadata = extractMetadata($);

    return {
      url,
      normalizedUrl: normalizeUrl(url),
      title,
      snippet,
      fullContent: fullContent.length > 1000 ? fullContent : undefined, // Only store if substantial
      headings,
      images,
      metadata,
      wordCount,
      fetchStatus: "success",
      fetchedAt,
    };
  } catch (error: any) {
    // Handle different error types
    if (error.name === "AbortError") {
      return {
        url,
        normalizedUrl: normalizeUrl(url),
        snippet: "",
        headings: [],
        images: [],
        metadata: {},
        wordCount: 0,
        fetchStatus: "timeout",
        fetchError: "Request timeout",
        fetchedAt,
      };
    }

    return {
      url,
      normalizedUrl: normalizeUrl(url),
      snippet: "",
      headings: [],
      images: [],
      metadata: {},
      wordCount: 0,
      fetchStatus: "failed",
      fetchError: error.message || "Unknown error",
      fetchedAt,
    };
  }
}

/**
 * Extract content with retry logic
 */
export async function extractContentWithRetry(
  url: string,
  options?: ExtractionOptions,
  maxRetries?: number
): Promise<ExtractedContent> {
  const defaultOpts = getDefaultOptions();
  const retryCount =
    maxRetries ?? options?.maxRetries ?? defaultOpts.maxRetries;
  const retryDelay = options?.retryDelayMs ?? defaultOpts.retryDelayMs;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      const result = await extractContent(url, options);

      // Don't retry on blocked or timeout (won't help)
      if (
        result.fetchStatus === "blocked" ||
        result.fetchStatus === "timeout"
      ) {
        return result;
      }

      // Success
      if (result.fetchStatus === "success") {
        return result;
      }

      // Failed, will retry
      lastError = new Error(result.fetchError || "Extraction failed");
    } catch (error) {
      lastError = error as Error;
    }

    if (attempt < retryCount) {
      // Wait before retry (linear backoff based on config delay)
      const delay = retryDelay * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries failed, return failed result
  return {
    url,
    normalizedUrl: normalizeUrl(url),
    snippet: "",
    headings: [],
    images: [],
    metadata: {},
    wordCount: 0,
    fetchStatus: "failed",
    fetchError: lastError?.message || "Extraction failed after retries",
    fetchedAt: Date.now(),
  };
}

/**
 * Extract content from multiple URLs in parallel (with concurrency limit)
 */
export async function extractMultipleContents(
  urls: string[],
  options?: ExtractionOptions
): Promise<ExtractedContent[]> {
  const concurrencyLimit = getExtractionConfig().concurrency;

  const results: ExtractedContent[] = [];
  const queue = [...urls];

  // Process URLs with limited concurrency
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrencyLimit);
    const batchResults = await Promise.all(
      batch.map((url) => extractContentWithRetry(url, options))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Get a preview of content (for logging/debugging)
 */
export function getContentPreview(content: ExtractedContent): string {
  const preview = [
    `URL: ${content.url}`,
    `Title: ${content.title || "N/A"}`,
    `Status: ${content.fetchStatus}`,
    `Words: ${content.wordCount}`,
    `Snippet: ${content.snippet.substring(0, 100)}${
      content.snippet.length > 100 ? "..." : ""
    }`,
  ];

  if (content.fetchError) {
    preview.push(`Error: ${content.fetchError}`);
  }

  return preview.join("\n");
}
