import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware during build time if env vars are not available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // During build time, just pass through
    return NextResponse.next();
  }

  // Public routes - no auth needed
  const publicRoutes = ['/', '/api/scan', '/login', '/register'];
  if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    // For login/register, redirect to admin if already logged in
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      try {
        const supabase = createServerClient(
          supabaseUrl,
          supabaseAnonKey,
          {
            cookies: {
              async getAll() {
                const cookieStore = await cookies();
                return cookieStore.getAll();
              },
              async setAll(cookiesToSet) {
                const cookieStore = await cookies();
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options);
                });
              },
            },
          }
        );
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
      } catch (error) {
        // If there's an error (e.g., during build), just continue
        console.error('Middleware error:', error);
      }
    }
    return NextResponse.next();
  }

  // Protected routes (admin, staff)
  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) {
    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            async getAll() {
              const cookieStore = await cookies();
              return cookieStore.getAll();
            },
            async setAll(cookiesToSet) {
              const cookieStore = await cookies();
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    } catch (error) {
      // If there's an error (e.g., during build), just continue
      console.error('Middleware error:', error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
