import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchByImage } from '@/lib/nvidia-dino';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { image } = body;

        if (!image) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        const supabase = getSupabase();

        // Get all products
        const { data: products, error } = await supabase
            .from('items')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
        }

        if (!products || products.length === 0) {
            return NextResponse.json({
                product: null,
                isExactMatch: false,
                similarProducts: [],
                message: 'No products in database',
                analysis: null
            });
        }

        try {
            const result = await searchByImage(image, products);

            // Find similar products
            const similarProducts = findSimilarProducts(result.analysis, products, result.match?.id);

            // Only return as product match if it's an EXACT match
            if (result.match && result.isExactMatch) {
                // Increment scan count for analytics
                const currentCount = typeof result.match.scan_count === 'number' ? result.match.scan_count : 0;
                await supabase
                    .from('items')
                    .update({ scan_count: currentCount + 1 })
                    .eq('id', result.match.id);

                return NextResponse.json({
                    product: result.match,
                    isExactMatch: true,
                    similarProducts: similarProducts.slice(0, 3),
                    confidence: result.confidence,
                    analysis: {
                        detected: result.analysis.name,
                        brand: result.analysis.brand,
                        category: result.analysis.category,
                        features: result.analysis.features,
                        colors: result.analysis.colors,
                        size: result.analysis.size,
                        material: result.analysis.material,
                    }
                });
            } else {
                // Not exact match - return as similar products
                const allSimilar = result.match
                    ? [result.match, ...similarProducts.filter(p => p.id !== result.match?.id)]
                    : similarProducts;

                return NextResponse.json({
                    product: null,
                    isExactMatch: false,
                    similarProducts: allSimilar.slice(0, 5),
                    message: 'No exact match - showing similar products',
                    analysis: {
                        detected: result.analysis.name,
                        brand: result.analysis.brand,
                        category: result.analysis.category,
                        features: result.analysis.features,
                        colors: result.analysis.colors,
                        size: result.analysis.size,
                        material: result.analysis.material,
                    }
                });
            }
        } catch (aiError) {
            console.error('AI analysis error:', aiError);
            return NextResponse.json({
                product: null,
                isExactMatch: false,
                similarProducts: products.slice(0, 5),
                error: aiError instanceof Error ? aiError.message : 'AI analysis failed'
            });
        }

    } catch (error) {
        console.error('Scan error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Scan failed' },
            { status: 500 }
        );
    }
}

interface ProductAnalysis {
    name: string;
    brand: string | null;
    category: string | null;
    description: string;
    features: string[];
    colors: string[];
    size: string | null;
    material: string | null;
}

function findSimilarProducts(
    analysis: ProductAnalysis,
    products: Array<{
        id: string;
        name: string;
        brand: string | null;
        category: string | null;
        distinguishing_features: string[] | null;
        [key: string]: unknown;
    }>,
    excludeId?: string
): typeof products {
    const analysisText = [
        analysis.name,
        analysis.brand,
        analysis.category,
        analysis.description,
        analysis.material,
        analysis.size,
        ...analysis.features,
        ...analysis.colors
    ].filter(Boolean).join(' ').toLowerCase();

    const scored = products
        .filter(p => p.id !== excludeId)
        .map(product => {
            let score = 0;

            // Category match
            if (analysis.category && product.category) {
                if (analysis.category.toLowerCase().includes(product.category.toLowerCase()) ||
                    product.category.toLowerCase().includes(analysis.category.toLowerCase())) {
                    score += 2;
                }
            }

            // Brand match
            if (analysis.brand && product.brand) {
                if (analysis.brand.toLowerCase() === product.brand.toLowerCase()) {
                    score += 3;
                }
            }

            // Name keywords
            const nameWords = product.name?.toLowerCase().split(/\s+/) || [];
            for (const word of nameWords) {
                if (word.length > 2 && analysisText.includes(word)) {
                    score += 0.5;
                }
            }

            // Features
            const features = product.distinguishing_features || [];
            for (const feature of features) {
                if (analysisText.includes(feature.toLowerCase())) {
                    score += 0.4;
                }
            }

            return { product, score };
        })
        .filter(({ score }) => score > 0.3)
        .sort((a, b) => b.score - a.score);

    return scored.map(({ product }) => product);
}

