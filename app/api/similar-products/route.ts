import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('similar_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching similar products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch similar products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can manage similar products
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single() as { data: { role: string } | null };

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { item1_id, item2_id, distinguishing_features } = body;

    if (!item1_id || !item2_id) {
      return NextResponse.json(
        { error: 'Both products are required' },
        { status: 400 }
      );
    }

    // Ensure consistent ordering (smaller ID first)
    const [id1, id2] = [item1_id, item2_id].sort();

    const { data, error } = await supabase
      .from('similar_products')
      .insert({
        item1_id: id1,
        item2_id: id2,
        distinguishing_features: distinguishing_features || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating similar products:', error);
    return NextResponse.json(
      { error: 'Failed to create similar products' },
      { status: 500 }
    );
  }
}
