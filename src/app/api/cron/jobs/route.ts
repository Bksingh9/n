import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { processBatch } from '@/lib/services/job-handlers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const isAuthorized = (req: Request, secret: string): boolean => {
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  if (process.env.NODE_ENV !== 'production' && req.headers.get('x-vercel-cron')) return true;
  return false;
};

const handle = async (req: Request) => {
  const env = serverEnv();
  if (!isAuthorized(req, env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await processBatch(50);
  return NextResponse.json({ ok: true, ...result });
};

export const GET = handle;
export const POST = handle;
