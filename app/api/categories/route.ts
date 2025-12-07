import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - List all categories (with hierarchy)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storeSlug = searchParams.get('storeSlug')?.toLowerCase() || null;
        const storeIdParam = searchParams.get('storeId');
        let storeId = storeIdParam;

        if (!storeId && storeSlug) {
            const { data: store, error: storeError } = await getSupabase()
                .from('stores')
                .select('id')
                .eq('slug', storeSlug)
                .limit(1)
                .single();
            if (storeError || !store) {
                return NextResponse.json({ error: 'Store not found' }, { status: 404 });
            }
            storeId = store.id;
        }

        const supabase = getSupabase();
        let query = supabase
            .from('categories')
            .select('*')
            .order('name');

        if (storeId) {
            query = query.or(`store_id.eq.${storeId},store_id.is.null`);
        }

        const { data: categories, error } = await query;

        if (error) throw error;

        // Build tree structure
        const tree = buildCategoryTree(categories || []);

        return NextResponse.json({ categories: categories || [], tree });
    } catch (error) {
        console.error('Categories error:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
}

// POST - Create category
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, parent_id, description, storeId } = body;

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Name required' }, { status: 400 });
        }

        const supabase = getSupabase();
        const { data: category, error } = await supabase
            .from('categories')
            .insert({
                name: name.trim(),
                parent_id: parent_id || null,
                description: description || null,
                store_id: storeId || null,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ category });
    } catch (error) {
        console.error('Create category error:', error);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }
}

// DELETE - Delete category
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 });
        }

        const supabase = getSupabase();
        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete category error:', error);
        return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
    }
}

interface Category {
    id: string;
    name: string;
    parent_id: string | null;
    description: string | null;
    children?: Category[];
}

function buildCategoryTree(categories: Category[]): Category[] {
    const map = new Map<string, Category>();
    const roots: Category[] = [];

    // First pass: create map
    categories.forEach(cat => {
        map.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach(cat => {
        const node = map.get(cat.id)!;
        if (cat.parent_id && map.has(cat.parent_id)) {
            map.get(cat.parent_id)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}

