// Centralized environment access. Server-only secrets are guarded so that
// importing them in a client component fails loudly.

const required = (name: string, value: string | undefined): string => {
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env var: ${name}`);
    }
    return '';
  }
  return value;
};

export const publicEnv = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
};

export const serverEnv = () => {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() called from client code');
  }
  return {
    SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER ?? '',
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO ?? '',
    STRIPE_PRICE_AGENCY: process.env.STRIPE_PRICE_AGENCY ?? '',
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL ?? 'DateOps Live <hello@dateops.live>',
    APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
    CRON_SECRET: process.env.CRON_SECRET ?? '',
  };
};
