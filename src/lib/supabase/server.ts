// Server-side Supabase clients.
// - createServerClient: bound to the user session via cookies.
// - createServiceClient: service-role client for trusted server-only ops
//   (webhooks, public token routes, activity event writes). NEVER ship to
//   the client.

import { createServerClient as createSSRClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';

export const createServerClient = async () => {
  const env = serverEnv();
  const cookieStore = await cookies();
  return createSSRClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // No-op: setAll is called from server components where cookies are read-only.
        }
      },
    },
  });
};

export const createServiceClient = () => {
  const env = serverEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
