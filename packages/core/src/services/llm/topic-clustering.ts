/**
 * Topic Clustering for Semantic Deduplication
 *
 * Groups semantically similar articles into clusters so the report
 * can consolidate coverage of the same story from multiple sources.
 */

import { generateEmbeddings, cosineSimilarity } from "./embeddings";
import type { ResultForReport, TopicCluster, ArticleSource } from "./types";

/**
 * Default similarity threshold for clustering
 * 0.85 = articles must be ~85% semantically similar to be grouped
 */
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

/**
 * Options for topic clustering
 */
export interface ClusteringOptions {
  similarityThreshold?: number; // 0-1, default 0.85
}

/**
 * Extract publication name from URL
 */
function extractPublicationName(url: string): string {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    // Remove www prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }

    // Extract domain name (before TLD)
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      // Handle cases like "news.ycombinator.com" -> "ycombinator"
      // and "theverge.com" -> "theverge"
      const domainPart = parts.length > 2 ? parts[parts.length - 2] : parts[0];

      // Capitalize and format
      return domainPart
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    return hostname;
  } catch {
    return "Unknown Source";
  }
}

/**
 * Create article source from result
 */
function createArticleSource(result: ResultForReport): ArticleSource {
  return {
    name: extractPublicationName(result.url),
    url: result.url,
    publishedDate: result.publishedDate,
  };
}

/**
 * Generate a unique cluster ID
 */
function generateClusterId(): string {
  return `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create text representation for embedding
 * Combines title and key points for better semantic matching
 */
function createEmbeddingText(result: ResultForReport): string {
  const title = result.title || "";
  const keyPoints = result.keyPoints?.join(". ") || "";
  const snippet = result.snippet?.substring(0, 500) || ""; // Limit snippet length

  return `${title}. ${keyPoints}. ${snippet}`.trim();
}

/**
 * Merge key points from multiple articles, removing duplicates
 */
function mergeKeyPoints(articles: ResultForReport[]): string[] {
  const allPoints: string[] = [];
  const seenNormalized = new Set<string>();

  for (const article of articles) {
    for (const point of article.keyPoints || []) {
      // Normalize for comparison (lowercase, trim)
      const normalized = point.toLowerCase().trim();

      // Skip if we've seen a very similar point
      let isDuplicate = false;
      for (const seen of seenNormalized) {
        // Simple check: if one contains the other or they're very similar length-wise
        if (
          seen.includes(normalized) ||
          normalized.includes(seen) ||
          (normalized.length > 20 &&
            seen.length > 20 &&
            Math.abs(normalized.length - seen.length) < 10 &&
            normalized.substring(0, 20) === seen.substring(0, 20))
        ) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seenNormalized.add(normalized);
        allPoints.push(point);
      }
    }
  }

  return allPoints;
}

/**
 * Infer topic title from cluster of articles
 * Uses the primary article's title as the base
 */
function inferClusterTopic(
  primary: ResultForReport,
  related: ResultForReport[]
): string {
  // For now, use the primary article's title
  // Could be enhanced with LLM summarization if needed
  return primary.title || "Related Articles";
}

/**
 * Cluster articles by semantic similarity using embeddings
 *
 * Algorithm:
 * 1. Generate embeddings for all articles
 * 2. Find pairs exceeding similarity threshold
 * 3. Use union-find to group connected articles
 * 4. Create TopicCluster objects for each group
 */
export async function clusterArticlesByTopic(
  articles: ResultForReport[],
  options?: ClusteringOptions
): Promise<TopicCluster[]> {
  const threshold =
    options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;

  if (articles.length === 0) {
    return [];
  }

  // Single article = single cluster
  if (articles.length === 1) {
    const article = articles[0];
    return [
      {
        id: generateClusterId(),
        topic: article.title || "Article",
        primaryArticle: article,
        relatedArticles: [],
        allSources: [createArticleSource(article)],
        combinedKeyPoints: article.keyPoints || [],
        averageScore: article.score,
      },
    ];
  }

  console.log(
    `Clustering ${articles.length} articles (threshold: ${threshold})...`
  );

  // Step 1: Generate embeddings
  const texts = articles.map(createEmbeddingText);
  const embeddings = await generateEmbeddings(texts);

  // Step 2: Build similarity graph using union-find
  const parent: number[] = articles.map((_, i) => i);

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x]); // Path compression
    }
    return parent[x];
  }

  function union(x: number, y: number): void {
    const px = find(x);
    const py = find(y);
    if (px !== py) {
      parent[px] = py;
    }
  }

  // Step 3: Find similar pairs and union them
  let pairsFound = 0;
  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      if (similarity >= threshold) {
        union(i, j);
        pairsFound++;
        console.log(
          `  Matched: "${articles[i].title?.substring(
            0,
            40
          )}..." <-> "${articles[j].title?.substring(0, 40)}..." (${(
            similarity * 100
          ).toFixed(1)}%)`
        );
      }
    }
  }

  console.log(`Found ${pairsFound} similar pairs`);

  // Step 4: Group articles by their root parent
  const groups = new Map<number, number[]>();
  for (let i = 0; i < articles.length; i++) {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(i);
  }

  // Step 5: Create TopicCluster objects
  const clusters: TopicCluster[] = [];

  for (const indices of groups.values()) {
    // Get articles in this cluster
    const clusterArticles = indices.map((i) => articles[i]);

    // Sort by score descending - highest score becomes primary
    clusterArticles.sort((a, b) => b.score - a.score);

    const primary = clusterArticles[0];
    const related = clusterArticles.slice(1);

    // Calculate average score
    const avgScore =
      clusterArticles.reduce((sum, a) => sum + a.score, 0) /
      clusterArticles.length;

    clusters.push({
      id: generateClusterId(),
      topic: inferClusterTopic(primary, related),
      primaryArticle: primary,
      relatedArticles: related,
      allSources: clusterArticles.map(createArticleSource),
      combinedKeyPoints: mergeKeyPoints(clusterArticles),
      averageScore: Math.round(avgScore),
    });
  }

  // Sort clusters by average score descending
  clusters.sort((a, b) => b.averageScore - a.averageScore);

  console.log(
    `Created ${clusters.length} clusters from ${articles.length} articles`
  );

  return clusters;
}

/**
 * Check if clustering would be beneficial
 * Returns true if there are likely duplicates worth clustering
 */
export async function shouldCluster(
  articles: ResultForReport[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD
): Promise<boolean> {
  if (articles.length < 2) {
    return false;
  }

  // Quick check: generate embeddings and look for any similar pairs
  const texts = articles.map(createEmbeddingText);
  const embeddings = await generateEmbeddings(texts);

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      if (cosineSimilarity(embeddings[i], embeddings[j]) >= threshold) {
        return true;
      }
    }
  }

  return false;
}
