import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { roleSatisfies } from '@/lib/roles';
import { createJoinCode, getActiveCode } from '@/lib/joinCodes';

const getServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service key is required for join codes.');
  }
  return createServiceClient(url, key);
};

const ensureAccess = async (userId: string, role: 'admin' | 'organizer', storeId: string) => {
  if (role === 'admin') return true;
  const supabaseService = getServiceClient();
  const { data: store } = await supabaseService
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('organizer_id', userId)
    .single();
  return Boolean(store);
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const role = (searchParams.get('role') || 'admin') as 'admin' | 'staff';

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

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

    const allowed = await ensureAccess(user.id, profile.role, storeId);
    if (!allowed) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const active = await getActiveCode(storeId, role);
    return NextResponse.json({
      code: active?.code || null,
      expiresAt: active?.expires_at || null,
      status: active?.status || null,
      id: active?.id || null,
    });
  } catch (error) {
    console.error('Join code GET error:', error);
    return NextResponse.json({ error: 'Failed to load code' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { storeId, role } = await request.json();
    const joinRole = role as 'admin' | 'staff';

    if (!storeId || !joinRole || !['admin', 'staff'].includes(joinRole)) {
      return NextResponse.json({ error: 'storeId and role are required' }, { status: 400 });
    }

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

    const allowed = await ensureAccess(user.id, profile.role, storeId);
    if (!allowed) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const code = await createJoinCode({ storeId, role: joinRole, createdBy: user.id });
    return NextResponse.json({
      code: code.code,
      expiresAt: code.expires_at,
      status: code.status,
      id: code.id,
    });
  } catch (error) {
    console.error('Join code POST error:', error);
    return NextResponse.json({ error: 'Failed to create code' }, { status: 500 });
  }
}
