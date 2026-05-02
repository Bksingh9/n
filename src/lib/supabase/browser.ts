// Browser Supabase client. Only uses anon key + user JWT.

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export const getBrowserClient = () => {
  if (_client) return _client;
  _client = createBrowserClient(publicEnv.SUPABASE_URL, publicEnv.SUPABASE_ANON_KEY);
  return _client;
};
