import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductImage, suggestCategory } from '@/lib/nvidia-dino';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface BulkResult {
    index: number;
    success: boolean;
    productId?: string;
    name?: string;
    error?: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { images, autoSave = false } = body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return NextResponse.json({ error: 'No images provided' }, { status: 400 });
        }

        // Get existing categories
        const { data: categories } = await supabase
            .from('categories')
            .select('id, name, parent_id');

        const results: BulkResult[] = [];
        const createdCategories: { [key: string]: string } = {};

        for (let i = 0; i < images.length; i++) {
            const image = images[i];

            try {
                // Analyze each image
                const analysis = await analyzeProductImage(image);
                const categorySuggestion = await suggestCategory(analysis, categories || []);

                let categoryId = categorySuggestion.categoryId;

                // Create new category if needed and autoSave
                if (autoSave && !categoryId && categorySuggestion.newCategory) {
                    const catKey = `${categorySuggestion.newCategory.parentId || 'root'}_${categorySuggestion.newCategory.name}`;

                    if (createdCategories[catKey]) {
                        categoryId = createdCategories[catKey];
                    } else {
                        const { data: newCat } = await supabase
                            .from('categories')
                            .insert({
                                name: categorySuggestion.newCategory.name,
                                parent_id: categorySuggestion.newCategory.parentId
                            })
                            .select()
                            .single();

                        if (newCat) {
                            categoryId = newCat.id;
                            createdCategories[catKey] = newCat.id;
                        }
                    }
                }

                if (autoSave) {
                    // Auto-save product
                    const { data: product, error } = await supabase
                        .from('items')
                        .insert({
                            name: analysis.name,
                            brand: analysis.brand,
                            category_id: categoryId,
                            description: analysis.description,
                            image_url: image,
                            distinguishing_features: analysis.features,
                            specifications: analysis.specifications,
                            price: analysis.suggestedPrice || 0,
                            quantity: 0,
                        })
                        .select()
                        .single();

                    if (error) {
                        results.push({ index: i, success: false, error: error.message });
                    } else {
                        results.push({ index: i, success: true, productId: product.id, name: analysis.name });
                    }
                } else {
                    // Return analysis only
                    results.push({
                        index: i,
                        success: true,
                        name: analysis.name,
                        ...analysis as unknown as BulkResult
                    });
                }

            } catch (err) {
                results.push({
                    index: i,
                    success: false,
                    error: err instanceof Error ? err.message : 'Analysis failed'
                });
            }
        }

        return NextResponse.json({
            total: images.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Bulk upload failed' },
            { status: 500 }
        );
    }
}
