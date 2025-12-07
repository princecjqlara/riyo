import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { roleSatisfies } from '@/lib/roles';

const DEFAULT_BRANDING = {
  title: 'PriceScan',
  subtitle: 'Wholesale Lookup',
};

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('branding')
      .select('title, subtitle')
      .eq('id', 'default')
      .single();

    if (error || !data) {
      return NextResponse.json(DEFAULT_BRANDING);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json(DEFAULT_BRANDING);
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
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !roleSatisfies(['admin', 'organizer'], profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : DEFAULT_BRANDING.title;
    const subtitle = typeof body.subtitle === 'string' && body.subtitle.trim() ? body.subtitle.trim() : DEFAULT_BRANDING.subtitle;

    const { data, error } = await supabase
      .from('branding')
      .upsert({
        id: 'default',
        title,
        subtitle,
        updated_by: user.id,
      })
      .select('id, title, subtitle, updated_by, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating branding:', error);
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 });
  }
}
