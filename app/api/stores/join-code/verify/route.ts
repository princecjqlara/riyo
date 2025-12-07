import { NextRequest, NextResponse } from 'next/server';
import { consumeJoinCode, verifyJoinCode } from '@/lib/joinCodes';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const getServiceClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service key is required for join codes.');
  }
  return createServiceClient(url, key);
};

export async function POST(request: NextRequest) {
  try {
    const { storeId, code, role, mode = 'check', userId } = await request.json();
    const joinRole = role as 'admin' | 'staff';

    if (!storeId || !code || !joinRole || !['admin', 'staff'].includes(joinRole)) {
      return NextResponse.json({ error: 'storeId, code, and role are required' }, { status: 400 });
    }

    const match = await verifyJoinCode({ storeId, role: joinRole, code });
    if (!match) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    if (mode === 'consume') {
      if (!userId) {
        return NextResponse.json({ error: 'userId is required to consume a code' }, { status: 400 });
      }

      const consumed = await consumeJoinCode({ id: match.id, userId });
      if (!consumed) {
        return NextResponse.json({ error: 'Code already used or expired' }, { status: 400 });
      }

      if (joinRole === 'admin') {
        const supabaseService = getServiceClient();
        const { data: profile } = await supabaseService
          .from('user_profiles')
          .select('full_name, email, role')
          .eq('id', userId)
          .single();

        // Promote to admin if not already higher
        const currentRole = profile?.role;
        if (currentRole !== 'admin' && currentRole !== 'organizer') {
          await supabaseService.from('user_profiles').update({ role: 'admin' }).eq('id', userId);
        }

        // Add to staff table for store scoping if missing
        const { data: existing } = await supabaseService
          .from('staff')
          .select('id')
          .eq('user_id', userId)
          .eq('store_id', storeId)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabaseService.from('staff').insert({
            user_id: userId,
            name: profile?.full_name || profile?.email || 'Admin',
            role: 'admin',
            store_id: storeId,
          });
        }
      }

      return NextResponse.json({
        status: consumed.status,
        expiresAt: consumed.expires_at,
        storeId: consumed.store_id,
        role: consumed.role,
        usedBy: consumed.used_by,
      });
    }

    return NextResponse.json({
      status: match.status,
      expiresAt: match.expires_at,
      storeId: match.store_id,
      role: match.role,
    });
  } catch (error) {
    console.error('Join code verify error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to verify code' }, { status: 500 });
  }
}
