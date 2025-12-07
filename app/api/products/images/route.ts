import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const itemId = formData.get('item_id') as string;
    const imageType = formData.get('image_type') as string;
    const isPrimary = formData.get('is_primary') === 'true';

    if (!file || !itemId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Upload image (reuse upload endpoint logic)
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const uploadResponse = await fetch(
      new URL('/api/upload', request.url),
      {
        method: 'POST',
        body: uploadFormData,
      }
    );

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image');
    }

    const { url } = await uploadResponse.json();

    // Note: Embedding will be generated client-side and sent separately
    // For now, save without embedding - it can be generated later via a separate endpoint
    // Convert embedding array to PostgreSQL vector format if provided
    const embeddingValue = null; // Will be set via separate endpoint
    
    const { data, error } = await supabase
      .from('product_images')
      .insert({
        item_id: itemId,
        image_url: url,
        image_type: imageType || null,
        embedding: embeddingValue,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving product image:', error);
    return NextResponse.json(
      { error: 'Failed to save product image' },
      { status: 500 }
    );
  }
}

