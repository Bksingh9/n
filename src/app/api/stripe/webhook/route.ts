import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, getStripePrices } from '@/lib/stripe';
import { serverEnv } from '@/lib/env';
import { createServiceClient } from '@/lib/supabase/server';
import { planFromPriceId, type PlanId } from '@/lib/plans';
import { createActivityEvent } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const findOrgByCustomer = async (customerId: string) => {
  const svc = createServiceClient();
  const { data } = await svc
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
};

const updateOrgPlan = async (
  organizationId: string,
  plan: PlanId,
  subscriptionId: string | null,
) => {
  const svc = createServiceClient();
  await svc
    .from('organizations')
    .update({ plan, stripe_subscription_id: subscriptionId })
    .eq('id', organizationId);
  await createActivityEvent({
    organizationId,
    eventType: 'SUBSCRIPTION_CHANGED',
    metadata: { plan },
  });
};

export async function POST(req: Request) {
  const env = serverEnv();
  const stripe = getStripe();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 });
  }
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  const prices = getStripePrices();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId =
        (session.metadata?.organization_id as string | undefined) ??
        (session.client_reference_id as string | null) ??
        (session.customer ? await findOrgByCustomer(String(session.customer)) : null);
      if (!organizationId) break;
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
      let plan: PlanId = 'free';
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const priceId = sub.items.data[0]?.price.id ?? '';
        plan = planFromPriceId(priceId, prices);
      } else if (session.metadata?.plan) {
        plan = session.metadata.plan as PlanId;
      }
      await updateOrgPlan(organizationId, plan, subId);
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const organizationId = await findOrgByCustomer(customerId);
      if (!organizationId) break;
      const priceId = sub.items.data[0]?.price.id ?? '';
      const plan = sub.status === 'active' || sub.status === 'trialing'
        ? planFromPriceId(priceId, prices)
        : 'free';
      await updateOrgPlan(organizationId, plan, sub.id);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const organizationId = await findOrgByCustomer(customerId);
      if (!organizationId) break;
      await updateOrgPlan(organizationId, 'free', null);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
