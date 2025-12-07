import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';

const slugify = (value: string) => {
  return (value || 'store')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64) || 'store';
};

const ensureUniqueSlug = async (supabase: ReturnType<typeof createClient>, desired: string) => {
  let base = slugify(desired);
  let candidate = base;
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', candidate)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    base = base.slice(0, 48);
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
};

const ensureDefaultStore = async ({
  supabase,
  userId,
  fullName,
  email,
}: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  fullName?: string | null;
  email?: string | null;
}) => {
  const { data: owned, error } = await supabase
    .from('stores')
    .select('*')
    .eq('organizer_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  if (owned && owned.length > 0) return owned[0];

  const baseName = fullName || email?.split('@')[0] || 'My Store';
  const uniqueSlug = await ensureUniqueSlug(supabase, baseName);

  const { data: created, error: insertError } = await supabase
    .from('stores')
    .insert({
      name: `${baseName}'s Store`,
      slug: uniqueSlug,
      organizer_id: userId,
      cover_url: null,
      avatar_url: null,
      bio: null,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
};

// Organizer-only store management
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let query = supabase
      .from('stores')
      .select('*')
      .order('created_at', { ascending: false });

    query = query.eq('organizer_id', user.id);

    const { data, error } = await query;
    if (error) throw error;
    let stores = data || [];

    if (stores.length === 0 && roleSatisfies(['admin', 'organizer'], profile.role)) {
      const defaultStore = await ensureDefaultStore({
        supabase,
        userId: user.id,
        fullName: profile.full_name,
        email: user.email,
      });
      if (defaultStore) {
        stores = [defaultStore];
      }
    }

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, slug, coverUrl, avatarUrl, bio } = await request.json();

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Store name is required' }, { status: 400 });
    }

    const uniqueSlug = await ensureUniqueSlug(supabase, slug || name);

    const { data, error } = await supabase
      .from('stores')
      .insert({
        name,
        slug: uniqueSlug,
        organizer_id: user.id,
        cover_url: coverUrl || null,
        avatar_url: avatarUrl || null,
        bio: bio || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, name, slug, coverUrl, avatarUrl, bio } = await request.json();
    if (!id || typeof id !== 'string' || !name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Store id and name are required' }, { status: 400 });
    }

    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (storeErr || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (store.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nextSlug = slug ? await ensureUniqueSlug(supabase, slug) : store.slug;

    const { data, error } = await supabase
      .from('stores')
      .update({
        name,
        slug: nextSlug,
        cover_url: coverUrl ?? store.cover_url ?? null,
        avatar_url: avatarUrl ?? store.avatar_url ?? null,
        bio: bio ?? store.bio ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ store: data });
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Store id is required' }, { status: 400 });
    }

    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('organizer_id')
      .eq('id', id)
      .single();

    if (storeErr || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (profile.role !== 'admin' && store.organizer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json({ error: 'Failed to delete store' }, { status: 500 });
  }
}
