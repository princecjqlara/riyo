import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can update corrections
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies('admin', profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { correct_item_id, status } = body;

    const updateData: Record<string, string> = {};
    if (correct_item_id) updateData.correct_item_id = correct_item_id;
    if (status) updateData.status = status;

    const { data, error } = await supabase
      .from('search_corrections')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating correction:', error);
    return NextResponse.json(
      { error: 'Failed to update correction' },
      { status: 500 }
    );
  }
}
