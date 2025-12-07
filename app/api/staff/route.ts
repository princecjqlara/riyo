import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';
import { consumeJoinCode, verifyJoinCode } from '@/lib/joinCodes';

const getServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service key is required to manage staff.');
  }

  return createServiceClient(supabaseUrl, serviceKey);
};

// GET - Get staff info (self lookup with userId, or list for admins/organizers)
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const supabaseService = getServiceClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (userId) {
      const { data, error } = await supabaseService
        .from('staff')
        .select(`
          id,
          user_id,
          name,
          role,
          store_id,
          created_at,
          store:stores(name),
          user:user_profiles(email, full_name)
        `)
        .eq('user_id', userId)
        .limit(1);

      if (error) throw error;
      const staff = data?.[0] || null;
      return NextResponse.json({ staff });
    }

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

    let allowedStoreIds: string[] | null = null;
    if (profile.role !== 'admin') {
      const { data: stores } = await supabaseService
        .from('stores')
        .select('id')
        .eq('organizer_id', user.id);
      allowedStoreIds = (stores || []).map((s: { id: string }) => s.id);
      if (allowedStoreIds.length === 0) {
        return NextResponse.json({ staff: [] });
      }
    }

    let query = supabaseService
      .from('staff')
      .select(`
        id,
        user_id,
        name,
        role,
        store_id,
        created_at,
        store:stores(name),
        user:user_profiles(email, full_name)
      `)
      .order('created_at', { ascending: false });

    if (allowedStoreIds) {
      query = query.in('store_id', allowedStoreIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    type StaffRow = {
      id: string;
      user_id: string;
      name: string;
      role: string;
      store_id: string | null;
      created_at: string;
      store?: { name?: string | null } | null;
      user?: { email?: string | null; full_name?: string | null } | null;
    };

    const staff = ((data || []) as StaffRow[]).map((member) => ({
      id: member.id,
      user_id: member.user_id,
      name: member.name,
      role: member.role,
      store_id: member.store_id || null,
      store_name: member.store?.name || null,
      email: member.user?.email || null,
      full_name: member.user?.full_name || null,
      created_at: member.created_at,
    }));

    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Staff error:', error);
    return NextResponse.json({ error: 'Failed to get staff' }, { status: 500 });
  }
}

// POST - Create staff member (requires valid store join code)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, role = 'staff', storeId, code } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: 'User ID and name required' }, { status: 400 });
    }

    if (!storeId || !code) {
      return NextResponse.json({ error: 'Store ID and join code are required' }, { status: 400 });
    }

    if (role !== 'staff') {
      return NextResponse.json({ error: 'Invalid role for staff creation' }, { status: 400 });
    }

    const verified = await verifyJoinCode({ storeId, role: 'staff', code });
    if (!verified) {
      return NextResponse.json({ error: 'Invalid or expired join code' }, { status: 400 });
    }

    const supabaseService = getServiceClient();

    // Prevent duplicates
    const { data: existing } = await supabaseService
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'User is already staff' }, { status: 400 });
    }

    // Ensure store exists when provided
    if (storeId) {
      const { data: store } = await supabaseService
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .single();
      if (!store) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
    }

    const consumed = await consumeJoinCode({ id: verified.id, userId });
    if (!consumed) {
      return NextResponse.json({ error: 'Join code already used or expired' }, { status: 400 });
    }

    const { data: staff, error } = await supabaseService
      .from('staff')
      .insert({ user_id: userId, name, role, store_id: storeId || null })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Create staff error:', error);
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }
}

// PUT - Update staff role or name
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, role, name, storeId } = body;

    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    }

    const updates: { role?: string; name?: string; store_id?: string | null } = {};
    if (role) updates.role = role;
    if (name) updates.name = name;
    if (storeId !== undefined) updates.store_id = storeId || null;

    const supabaseService = getServiceClient();
    const { data: staff, error } = await supabaseService
      .from('staff')
      .update(updates)
      .eq('id', staffId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Update staff error:', error);
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 });
  }
}

// DELETE - Remove staff/admin from a store
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { staffId } = await request.json();
    if (!staffId) {
      return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
    }

    const supabaseService = getServiceClient();
    const { data: member, error: memberErr } = await supabaseService
      .from('staff')
      .select('id, store_id')
      .eq('id', staffId)
      .single();

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    if (profile.role !== 'admin') {
      if (!member.store_id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const { data: store } = await supabaseService
        .from('stores')
        .select('organizer_id')
        .eq('id', member.store_id)
        .single();
      if (!store || store.organizer_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabaseService.from('staff').delete().eq('id', staffId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
