import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
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

    const body = await request.json();
    const { embedding } = body;

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: 'Invalid embedding' },
        { status: 400 }
      );
    }

    // Update the product image with embedding
    // Convert array to PostgreSQL vector format: '[1,2,3]'::vector
    const embeddingVector = `[${embedding.join(',')}]`;
    
    const { data, error } = await supabase
      .from('product_images')
      .update({
        embedding: embeddingVector as any, // Supabase will handle vector conversion
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating embedding:', error);
    return NextResponse.json(
      { error: 'Failed to update embedding' },
      { status: 500 }
    );
  }
}

