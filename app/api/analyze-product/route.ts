import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductImage, suggestCategory } from '@/lib/nvidia-dino';
import { createClient } from '@supabase/supabase-js';

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

        // Enhanced detailed analysis
        const analysis = await analyzeProductImage(image);

        // Get existing categories for auto-categorization
        const supabase = getSupabase();
        const { data: categories } = await supabase
            .from('categories')
            .select('id, name, parent_id');

        // Suggest category
        const categorySuggestion = await suggestCategory(analysis, categories || []);

        return NextResponse.json({
            analysis: {
                name: analysis.name,
                brand: analysis.brand,
                category: analysis.category,
                subcategory: analysis.subcategory,
                description: analysis.description,
                features: analysis.features,
                colors: analysis.colors,
                size: analysis.size,
                material: analysis.material,
                specifications: analysis.specifications,
                suggestedPrice: analysis.suggestedPrice,
            },
            categorySuggestion,
            rawAnalysis: analysis.rawResponse
        });

    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Analysis failed' },
            { status: 500 }
        );
    }
}

