import { NextRequest, NextResponse } from 'next/server';
import { analyzeProductImage, suggestCategory } from '@/lib/nvidia-dino';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';

const ensureStoreAccess = async (
    supabase: ReturnType<typeof createClient>,
    storeId: string,
    userId: string,
    role: string,
) => {
    if (!storeId) return false;
    if (role === 'admin') return true;

    if (role === 'staff') {
        const { data, error } = await supabase
            .from('staff')
            .select('store_id')
            .eq('user_id', userId)
            .eq('store_id', storeId)
            .limit(1);
        if (error) throw error;
        return !!data && data.length > 0;
    }

    const { data: store, error } = await supabase
        .from('stores')
        .select('organizer_id')
        .eq('id', storeId)
        .single();
    if (error) throw error;
    return store?.organizer_id === userId;
};

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
        const { images, autoSave = false, storeId } = body;

        if (!images || !Array.isArray(images) || images.length === 0) {
            return NextResponse.json({ error: 'No images provided' }, { status: 400 });
        }

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // For autosave we need an authenticated user with privileges and a target store
        let userRole: string | null = null;
        if (autoSave) {
            if (!user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            userRole = profile?.role || null;
            if (!userRole || !roleSatisfies(['admin', 'staff', 'organizer'], userRole as any)) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            if (!storeId) {
                return NextResponse.json({ error: 'Store is required for bulk save' }, { status: 400 });
            }

            const allowed = await ensureStoreAccess(supabase, storeId, user.id, userRole);
            if (!allowed) {
                return NextResponse.json({ error: 'Store not found' }, { status: 404 });
            }
        }

        // Get existing categories
        let categoryQuery = supabase
            .from('categories')
            .select('id, name, parent_id, store_id');

        // Scope to the target store (or global/null categories) if provided
        if (storeId) {
            categoryQuery = categoryQuery.or(`store_id.eq.${storeId},store_id.is.null`);
        }

        const { data: categories } = await categoryQuery;

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
                                parent_id: categorySuggestion.newCategory.parentId,
                                store_id: storeId || null,
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
                            store_id: storeId || null,
                            created_by: user?.id || null,
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
                        ...analysis as unknown as BulkResult,
                        index: i,
                        success: true,
                        name: analysis.name,
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

