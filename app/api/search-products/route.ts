import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q')?.trim().toLowerCase();
        const categoryId = searchParams.get('category');
        const productCode = searchParams.get('code')?.trim();

        // Build query
        let dbQuery = supabase.from('items').select('*');

        // Filter by category if provided
        if (categoryId) {
            dbQuery = dbQuery.eq('category_id', categoryId);
        }

        // Direct product code lookup
        if (productCode) {
            dbQuery = dbQuery.ilike('product_code', `%${productCode}%`);
        }

        const { data: products, error } = await dbQuery.order('created_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
        }

        if (!products || products.length === 0) {
            return NextResponse.json({ products: [] });
        }

        // If category only or code lookup (no search query)
        if ((categoryId || productCode) && !query) {
            return NextResponse.json({ products, total: products.length });
        }

        // If all flag, return all products
        const allFlag = searchParams.get('all');
        if (allFlag === 'true') {
            return NextResponse.json({ products, total: products.length });
        }

        // If no query, return empty
        if (!query) {
            return NextResponse.json({ products: [] });
        }

        // Advanced search by keywords
        const queryWords = query.split(/\s+/).filter(w => w.length > 1);

        const results = products
            .map(product => {
                // Include more fields in searchable text
                const specs = product.specifications ? Object.values(product.specifications).join(' ') : '';
                const sizes = product.sizes ? JSON.stringify(product.sizes) : '';

                const searchText = [
                    product.name,
                    product.brand,
                    product.category,
                    product.description,
                    product.product_code,
                    specs,
                    sizes,
                    ...(product.distinguishing_features || [])
                ].filter(Boolean).join(' ').toLowerCase();

                let score = 0;

                // Product code exact match - highest priority
                if (product.product_code?.toLowerCase() === query) {
                    score += 10;
                }

                for (const word of queryWords) {
                    if (searchText.includes(word)) {
                        score += 1;
                        if (product.name?.toLowerCase().includes(word)) score += 2;
                        if (product.brand?.toLowerCase().includes(word)) score += 1.5;
                        if (product.product_code?.toLowerCase().includes(word)) score += 3;
                    }
                }
                if (searchText.includes(query)) score += 3;

                return { product, score };
            })
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 30)
            .map(({ product }) => product);

        return NextResponse.json({ products: results, query, total: results.length });

    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
