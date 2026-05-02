import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';

export async function POST() {
  const ctx = await requireOrg();
  const stripe = getStripe();
  const env = serverEnv();
  const svc = createServiceClient();
  const { data: org } = await svc
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', ctx.organizationId)
    .single();
  if (!org?.stripe_customer_id) {
    return NextResponse.json({ error: 'No customer on file' }, { status: 400 });
  }
  const portal = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${env.APP_URL}/app/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
