import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Store slug is required' }, { status: 400 });
    }

    const { data: store, error } = await getSupabase()
      .from('stores')
      .select('id, name, slug, cover_url, avatar_url, bio, created_at')
      .eq('slug', slug.toLowerCase())
      .limit(1)
      .single();

    if (error || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ store });
  } catch (error) {
    console.error('Storefront lookup failed:', error);
    return NextResponse.json({ error: 'Failed to load store' }, { status: 500 });
  }
}
