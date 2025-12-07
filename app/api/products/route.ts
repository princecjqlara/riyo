import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';

const ensureStoreAccess = async (
  supabase: ReturnType<typeof createClient>,
  storeId: string,
  userId: string,
  role: string,
) => {
  if (!storeId) return false;

  if (role === 'staff') {
    const { data, error } = await supabase
      .from('staff')
      .select('store_id')
      .eq('user_id', userId)
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) {
      return data[0].store_id === storeId;
    }
    return false;
  }

  const { data: store, error } = await supabase
    .from('stores')
    .select('organizer_id')
    .eq('id', storeId)
    .single();

  if (error) throw error;
  if (!store) return false;
  return store.organizer_id === userId;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'staff', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    const allowed = await ensureStoreAccess(supabase, storeId, user.id, profile.role);
    if (!allowed) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
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

    // Check role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'staff', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const storeId = body.store_id || body.storeId;
    if (!storeId) {
      return NextResponse.json({ error: 'Store is required' }, { status: 400 });
    }
    const productData = {
      name: body.name,
      price: body.price,
      description: body.description || null,
      category: body.category || null,
      category_id: body.category_id || body.categoryId || null,
      image_url: body.image_url || null,
      additional_images: body.additional_images || null,
      quantity: body.quantity ?? null,
      barcode: body.barcode || null,
      sku: body.sku || null,
      brand: body.brand || null,
      model_number: body.model_number || null,
      distinguishing_features: body.distinguishing_features || null,
      wholesale_tiers: body.wholesale_tiers || [],
      product_code: body.product_code || null,
      sizes: body.sizes || [],
      specifications: body.specifications || {},
      min_confidence: body.min_confidence || 0.7,
      created_by: user.id,
      store_id: storeId,
    };

    const allowed = await ensureStoreAccess(supabase, storeId, user.id, profile.role);
    if (!allowed) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('items')
      .insert(productData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// Bulk delete products (admin + organizer)
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

    const { ids, storeId } = await request.json();
    if (!Array.isArray(ids) || ids.length === 0 || !storeId) {
      return NextResponse.json({ error: 'Store and product IDs are required' }, { status: 400 });
    }

    const allowed = await ensureStoreAccess(supabase, storeId, user.id, profile.role);
    if (!allowed) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('items')
      .delete()
      .in('id', ids)
      .eq('store_id', storeId);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error('Error deleting products:', error);
    return NextResponse.json(
      { error: 'Failed to delete products' },
      { status: 500 }
    );
  }
}
