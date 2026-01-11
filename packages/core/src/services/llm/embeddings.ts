/**
 * OpenAI Embeddings for semantic similarity
 *
 * Uses text-embedding-3-small for efficient, low-cost embeddings
 * to detect semantically similar articles.
 */

import { getClient } from "./client";

/**
 * Embedding model configuration
 */
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536; // Default for text-embedding-3-small

/**
 * Generate embeddings for a list of texts
 * Uses batch API for efficiency
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getClient();

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: texts,
    });

    // Sort by index to ensure correct order
    const sortedData = response.data.sort((a, b) => a.index - b.index);
    return sortedData.map((item) => item.embedding);
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([text]);
  return embeddings[0];
}

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Vector length mismatch: ${vecA.length} vs ${vecB.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * Calculate similarity matrix for a list of embeddings
 * Returns a 2D array where matrix[i][j] is the similarity between items i and j
 */
export function calculateSimilarityMatrix(embeddings: number[][]): number[][] {
  const n = embeddings.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-similarity is always 1
    for (let j = i + 1; j < n; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      matrix[i][j] = similarity;
      matrix[j][i] = similarity; // Symmetric
    }
  }

  return matrix;
}

/**
 * Find pairs of items that exceed a similarity threshold
 */
export function findSimilarPairs(
  embeddings: number[][],
  threshold: number = 0.85
): Array<{ i: number; j: number; similarity: number }> {
  const pairs: Array<{ i: number; j: number; similarity: number }> = [];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
      if (similarity >= threshold) {
        pairs.push({ i, j, similarity });
      }
    }
  }

  // Sort by similarity descending
  return pairs.sort((a, b) => b.similarity - a.similarity);
}
