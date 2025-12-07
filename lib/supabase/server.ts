import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // During build time, throw a more descriptive error that Next.js can handle
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error(
        '@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client! ' +
        'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.'
      );
    }
    throw new Error('Supabase URL and Anon Key must be set in environment variables');
  }

  try {
    const cookieStore = cookies();

    return createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          async getAll() {
            return (await cookieStore).getAll();
          },
          async setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            try {
              const store = await cookieStore;
              cookiesToSet.forEach(({ name, value, options }) =>
                store.set(name, value, options as Parameters<typeof store.set>[2])
              );
            } catch {
              // The `setAll` method was called from a Server Component.
            }
          },
        },
      }
    );
  } catch (error) {
    // Handle cases where cookies() might not be available (e.g., during build)
    if (error instanceof Error && error.message.includes('cookies')) {
      throw new Error(
        '@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client! ' +
        'This error may occur during build time. Ensure environment variables are set.'
      );
    }
    throw error;
  }
}
