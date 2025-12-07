import { NextRequest, NextResponse } from 'next/server';
import { consumeJoinCode, verifyJoinCode } from '@/lib/joinCodes';

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
      const consumed = await consumeJoinCode({ id: match.id, userId });
      if (!consumed) {
        return NextResponse.json({ error: 'Code already used or expired' }, { status: 400 });
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
