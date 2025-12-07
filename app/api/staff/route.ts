import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET - Get staff info for current user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { data: staff } = await supabase
      .from('staff')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!staff) {
      return NextResponse.json({ staff: null });
    }

    return NextResponse.json({ staff });

  } catch (error) {
    console.error('Staff error:', error);
    return NextResponse.json({ error: 'Failed to get staff' }, { status: 500 });
  }
}

// POST - Create staff member (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, role = 'staff' } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: 'User ID and name required' }, { status: 400 });
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'User is already staff' }, { status: 400 });
    }

    const { data: staff, error } = await supabase
      .from('staff')
      .insert({ user_id: userId, name, role })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ staff });

  } catch (error) {
    console.error('Create staff error:', error);
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }
}

// PUT - Update staff role
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, role, name } = body;

    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID required' }, { status: 400 });
    }

    const updates: { role?: string; name?: string } = {};
    if (role) updates.role = role;
    if (name) updates.name = name;

    const { data: staff, error } = await supabase
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
