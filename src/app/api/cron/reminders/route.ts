import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { dispatchReminders } from '@/lib/services/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const isAuthorized = (req: Request, secret: string): boolean => {
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  // Vercel cron sends an x-vercel-cron header; we still require the secret in
  // production, but accept the header in dev so manual triggers work.
  if (process.env.NODE_ENV !== 'production' && req.headers.get('x-vercel-cron')) return true;
  return false;
};

const handle = async (req: Request) => {
  const env = serverEnv();
  if (!isAuthorized(req, env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await dispatchReminders();
  return NextResponse.json({ ok: true, ...result });
};

export const GET = handle;
export const POST = handle;
