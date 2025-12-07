import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findSimilarItems } from '@/lib/similarity';
import type { Item, ProductImage, SearchResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { embedding } = body;

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: 'No embedding provided' },
        { status: 400 }
      );
    }

    const queryEmbedding = embedding as number[];

    // Get all items with their embeddings
    const supabase = createClient();
    
    // Fetch all items
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*');

    if (itemsError) throw itemsError;

    // Fetch all product images with embeddings
    const { data: productImages, error: imagesError } = await supabase
      .from('product_images')
      .select('*')
      .not('embedding', 'is', null);

    if (imagesError) throw imagesError;

    // Also check legacy embeddings table
    const { data: legacyEmbeddings } = await supabase
      .from('item_embeddings')
      .select('*')
      .not('embedding', 'is', null);

    // Group images by item_id
    const imagesByItem = new Map<string, ProductImage[]>();
    productImages?.forEach((img) => {
      const existing = imagesByItem.get(img.item_id) || [];
      existing.push(img as ProductImage);
      imagesByItem.set(img.item_id, existing);
    });

    // Group legacy embeddings by item_id
    const legacyByItem = new Map<string, number[]>();
    legacyEmbeddings?.forEach((emb) => {
      if (emb.embedding) {
        legacyByItem.set(emb.item_id, emb.embedding as number[]);
      }
    });

    // Prepare embeddings for similarity search
    const itemEmbeddings = (items || [])
      .map((item) => {
        const images = imagesByItem.get(item.id) || [];
        const embeddings = images
          .filter((img) => img.embedding)
          .map((img) => {
            // Parse embedding if it's a string
            if (typeof img.embedding === 'string') {
              try {
                return JSON.parse(img.embedding);
              } catch {
                return null;
              }
            }
            return img.embedding as number[];
          })
          .filter((emb): emb is number[] => emb !== null);

        // If no product images, check legacy embeddings
        if (embeddings.length === 0) {
          const legacyEmb = legacyByItem.get(item.id);
          if (legacyEmb) {
            return {
              item: item as Item,
              embeddings: [legacyEmb],
              images: [],
            };
          }
          return null;
        }

        return {
          item: item as Item,
          embeddings,
          images,
        };
      })
      .filter((item): item is {
        item: Item;
        embeddings: number[][];
        images: ProductImage[];
      } => item !== null);

    // Find similar items
    if (itemEmbeddings.length === 0) {
      return NextResponse.json({
        results: [],
        warning: 'No products with images found in database. Please add products first.',
      });
    }

    const matches = findSimilarItems(queryEmbedding, itemEmbeddings, 0.7);

    // Check for similar products and adjust results
    const response: SearchResponse = {
      results: matches.slice(0, 5).map((match) => ({
        item: match.item,
        confidence: match.confidence,
        images: match.images,
      })),
    };

    // Check if top results are similar products
    if (matches.length > 1) {
      const topMatch = matches[0];
      const secondMatch = matches[1];

      // Check if these are marked as similar products
      const { data: similarProducts } = await supabase
        .from('similar_products')
        .select('*')
        .or(
          `and(item1_id.eq.${topMatch.item.id},item2_id.eq.${secondMatch.item.id}),and(item1_id.eq.${secondMatch.item.id},item2_id.eq.${topMatch.item.id})`
        )
        .limit(1)
        .maybeSingle();

      if (similarProducts) {
        response.warning = 'Multiple similar products found. Please check the details carefully.';
        if (similarProducts.distinguishing_features) {
          response.distinguishingFeatures = [
            similarProducts.distinguishing_features,
          ];
        }
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to process search' },
      { status: 500 }
    );
  }
}

