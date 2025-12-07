import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';
import { generateStaffCode, getCodeExpiry, verifyStaffCode } from '@/lib/staffCodes';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const getServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service key is required for staff join codes.');
  }

  return createServiceClient(supabaseUrl, serviceKey);
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

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

    // Ensure the organizer owns the store (admins can see all)
    if (profile.role !== 'admin') {
      const supabaseService = getServiceClient();
      const { data: store } = await supabaseService
        .from('stores')
        .select('id')
        .eq('id', storeId)
        .eq('organizer_id', user.id)
        .single();

      if (!store) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
    }

    const now = Date.now();
    const code = generateStaffCode(storeId, now);
    const expiresAt = getCodeExpiry(now);

    return NextResponse.json({ code, expiresAt });
  } catch (error) {
    console.error('Staff code GET error:', error);
    return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { storeId, code } = await request.json();
    if (!storeId || !code) {
      return NextResponse.json({ error: 'storeId and code are required' }, { status: 400 });
    }

    const verification = verifyStaffCode(storeId, code);
    if (!verification.valid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    return NextResponse.json({ storeId, expiresAt: verification.expiresAt });
  } catch (error) {
    console.error('Staff code verify error:', error);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
