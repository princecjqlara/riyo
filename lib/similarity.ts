/**
 * Similarity search utilities for finding similar items using vector embeddings
 * Uses cosine similarity for comparing embeddings
 */

import type { Item, ProductImage } from '@/types';

/**
 * Calculate cosine similarity between two vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Item with multiple embeddings (from different images)
 */
export interface ItemWithEmbeddings {
  item: Item;
  embeddings: number[][];
  images: ProductImage[];
}

/**
 * Match result with confidence score
 */
export interface SimilarityMatch {
  item: Item;
  confidence: number;
  images: ProductImage[];
}

/**
 * Find similar items based on embedding similarity
 * 
 * @param queryEmbedding - The embedding vector to search for
 * @param itemEmbeddings - Array of items with their embeddings
 * @param minConfidence - Minimum confidence threshold (0-1), default 0.7
 * @returns Array of matches sorted by confidence (highest first)
 */
export function findSimilarItems(
  queryEmbedding: number[],
  itemEmbeddings: ItemWithEmbeddings[],
  minConfidence: number = 0.7
): SimilarityMatch[] {
  const matches: SimilarityMatch[] = [];

  for (const itemData of itemEmbeddings) {
    let maxSimilarity = 0;
    let bestEmbedding: number[] | null = null;

    // Compare query against all embeddings for this item
    // Take the best match (highest similarity)
    for (const embedding of itemData.embeddings) {
      try {
        // Normalize embeddings if needed (they should already be normalized)
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestEmbedding = embedding;
        }
      } catch (error) {
        console.error(`Error calculating similarity for item ${itemData.item.id}:`, error);
        continue;
      }
    }

    // Only include matches above the threshold
    if (maxSimilarity >= minConfidence) {
      matches.push({
        item: itemData.item,
        confidence: maxSimilarity,
        images: itemData.images || [],
      });
    }
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

/**
 * Find the single best match for an embedding
 */
export function findBestMatch(
  queryEmbedding: number[],
  itemEmbeddings: ItemWithEmbeddings[],
  minConfidence: number = 0.7
): SimilarityMatch | null {
  const matches = findSimilarItems(queryEmbedding, itemEmbeddings, minConfidence);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Calculate similarity between two embeddings
 * Useful for comparing specific items
 */
export function calculateSimilarity(embedding1: number[], embedding2: number[]): number {
  return cosineSimilarity(embedding1, embedding2);
}
