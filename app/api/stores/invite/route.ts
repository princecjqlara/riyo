import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const getServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service key is required to send invites.');
  }

  return createServiceClient(supabaseUrl, serviceKey);
};

export async function GET(request: NextRequest) {
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

    if (!profile || !roleSatisfies('organizer', profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const supabaseService = getServiceClient();

    // Ensure the store(s) belong to this organizer
    const { data: stores, error: storeError } = await supabaseService
      .from('stores')
      .select('id')
      .eq('organizer_id', user.id);

    if (storeError) throw storeError;
    const storeIds = (stores || []).map((s: { id: string }) => s.id);

    if (storeId && !storeIds.includes(storeId)) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const idsToQuery = storeId ? [storeId] : storeIds;

    if (idsToQuery.length === 0) {
      return NextResponse.json({ invites: [] });
    }

    const { data: invites, error } = await supabaseService
      .from('store_admin_invites')
      .select('*')
      .in('store_id', idsToQuery)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('Error fetching admin invites:', error);
    return NextResponse.json({ error: 'Failed to load invites' }, { status: 500 });
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

    if (!profile || !roleSatisfies('organizer', profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storeId, email } = await request.json();

    if (!storeId || !email) {
      return NextResponse.json({ error: 'Store and email are required' }, { status: 400 });
    }

    const supabaseService = getServiceClient();

    // Verify ownership
    const { data: store, error: storeError } = await supabaseService
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('organizer_id', user.id)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const inviteToken = randomUUID();

    const { data: invite, error: inviteError } = await supabaseService
      .from('store_admin_invites')
      .insert({
        store_id: storeId,
        email,
        status: 'pending',
        invite_token: inviteToken,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    let sendStatus: 'pending' | 'sent' | 'failed' = 'pending';
    let sendError: string | null = null;

    try {
      await supabaseService.auth.admin.inviteUserByEmail(email, {
        data: { role: 'admin', store_id: storeId, invite_token: inviteToken },
        redirectTo: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
          : undefined,
      });
      sendStatus = 'sent';
    } catch (err) {
      console.error('Error sending invite email:', err);
      sendStatus = 'failed';
      sendError = err instanceof Error ? err.message : 'Unknown error sending invite';
    }

    // Update status to reflect delivery attempt
    const { data: updatedInvite } = await supabaseService
      .from('store_admin_invites')
      .update({ status: sendStatus })
      .eq('id', invite.id)
      .select()
      .single();

    return NextResponse.json({
      invite: updatedInvite || invite,
      warning: sendStatus === 'failed' ? sendError : undefined,
    });
  } catch (error) {
    console.error('Error inviting admin:', error);
    return NextResponse.json({ error: 'Failed to invite admin' }, { status: 500 });
  }
}
