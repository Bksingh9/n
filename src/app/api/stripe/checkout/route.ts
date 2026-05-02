import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripe, getStripePrices } from '@/lib/stripe';
import { requireOrg } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';
import { PLANS, type PlanId } from '@/lib/plans';

const Schema = z.object({ plan: z.enum(['starter', 'pro', 'agency']) });

export async function POST(req: Request) {
  const ctx = await requireOrg();
  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const plan = parsed.data.plan as PlanId;
  const prices = getStripePrices();
  const priceId = plan === 'starter' ? prices.starter : plan === 'pro' ? prices.pro : prices.agency;
  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 500 });
  }

  const stripe = getStripe();
  const env = serverEnv();
  const svc = createServiceClient();

  const { data: org } = await svc
    .from('organizations')
    .select('stripe_customer_id, contact_email')
    .eq('id', ctx.organizationId)
    .single();

  let customerId = org?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: org?.contact_email ?? ctx.user.email ?? undefined,
      name: ctx.organizationName,
      metadata: { organization_id: ctx.organizationId },
    });
    customerId = customer.id;
    await svc
      .from('organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', ctx.organizationId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.APP_URL}/app/billing?status=success`,
    cancel_url: `${env.APP_URL}/app/billing?status=cancelled`,
    metadata: { organization_id: ctx.organizationId, plan },
    subscription_data: {
      metadata: { organization_id: ctx.organizationId, plan },
    },
    allow_promotion_codes: true,
    client_reference_id: ctx.organizationId,
  });

  return NextResponse.json({ url: session.url, plan: PLANS[plan].name });
}
